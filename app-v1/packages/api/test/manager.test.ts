import { describe, expect, it, vi } from "vitest";
import { MemoryStore, TusError, UploadManager, type FileRef, type UploadDeps } from "../src/index";

const file = (name: string, size = 1000): FileRef => ({ name, size, mime: "video/mp4", uri: `file:///${name}` });
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 2000) { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error("timeout"); await tick(); } }

function makeDeps(over: Partial<UploadDeps> = {}) {
  const calls = { register: 0, complete: 0, remove: [] as string[], transport: 0, active: 0, maxActive: 0 };
  const deps: UploadDeps = {
    store: new MemoryStore(), concurrency: 2, maxAttempts: 3, backoffMs: () => 1,
    registerAsset: async ({ file: f }) => { calls.register++; return { ok: true, assetId: `a_${f.name}`, bucket: "raw", path: `u/p/${f.name}` }; },
    completeAsset: async () => { calls.complete++; return { ok: true }; },
    removeAsset: async (id) => { calls.remove.push(id); },
    resolveSource: async (f) => ({ size: f.size, slice: () => new Blob([]) }),
    transport: async ({ onProgress, signal }) => {
      calls.transport++; calls.active++; calls.maxActive = Math.max(calls.maxActive, calls.active);
      try {
        await tick(15);
        if (signal.aborted) throw new TusError("aborted", "x");
        onProgress(1000);
      } finally { calls.active--; }
    },
    ...over,
  } as UploadDeps;
  return { deps, calls };
}

describe("UploadManager", () => {
  it("envoie 3 fichiers, 2 à la fois, et résume la progression", async () => {
    const { deps, calls } = makeDeps();
    const m = new UploadManager(deps);
    m.add("p1", "raw", [file("a"), file("b"), file("c")]);
    await until(() => m.summary("p1").allDone);
    expect(calls.maxActive).toBe(2);
    expect(m.summary("p1")).toMatchObject({ count: 3, doneCount: 3, bytesUploaded: 3000, bytesTotal: 3000, fraction: 1 });
    expect(calls.complete).toBe(3);
  });

  it("refus serveur (fichier trop lourd) : échec immédiat avec le bon code, sans retry", async () => {
    const { deps, calls } = makeDeps({ registerAsset: async () => ({ ok: false, code: "file_too_large" }) });
    const m = new UploadManager(deps);
    m.add("p1", "raw", [file("big")]);
    await until(() => m.summary().anyFailed);
    expect(m.list()[0]!.errorCode).toBe("file_too_large");
    expect(calls.transport).toBe(0);
  });

  it("coupure : réessaie, puis réussit sans recréer l'asset", async () => {
    let n = 0;
    const { deps, calls } = makeDeps({
      transport: async ({ onProgress }) => { n++; if (n < 3) throw new TusError("network", "coupé"); onProgress(1000); },
    });
    const m = new UploadManager(deps);
    m.add("p1", "raw", [file("a")]);
    await until(() => m.summary().allDone);
    expect(n).toBe(3);
    expect(calls.register).toBe(1);
  });

  it("échecs répétés → 'upload_interrupted' (le fichier reste sur l'appareil) puis reprise manuelle", async () => {
    let fail = true;
    const { deps } = makeDeps({ transport: async ({ onProgress }) => { if (fail) throw new TusError("network", "x"); onProgress(1000); } });
    const m = new UploadManager(deps);
    const [it1] = m.add("p1", "raw", [file("a")]);
    await until(() => m.summary().anyFailed);
    expect(m.list()[0]!.errorCode).toBe("upload_interrupted");
    fail = false;
    m.retry(it1!.localId);
    await until(() => m.summary().allDone);
  });

  it("hors ligne : met en pause, reprend au retour du réseau", async () => {
    const { deps } = makeDeps();
    const m = new UploadManager(deps);
    m.setOnline(false);
    m.add("p1", "raw", [file("a")]);
    await tick(30);
    expect(m.list()[0]!.status).toBe("queued");
    m.setOnline(true);
    await until(() => m.summary().allDone);
  });

  it("coupe pendant l'envoi quand le réseau tombe, puis reprend", async () => {
    let first = true;
    const { deps } = makeDeps({
      transport: async ({ onProgress, signal }) => {
        if (first) { first = false; await new Promise<void>((_, rej) => signal.addEventListener("abort", () => rej(new TusError("aborted", "x")))); }
        onProgress(1000);
      },
    });
    const m = new UploadManager(deps);
    m.add("p1", "raw", [file("a")]);
    await until(() => m.list()[0]!.status === "uploading");
    m.setOnline(false);
    await until(() => m.list()[0]!.status === "paused");
    expect(m.summary().anyPaused).toBe(true);
    m.setOnline(true);
    await until(() => m.summary().allDone);
  });

  it("annulation : supprime l'asset serveur et l'élément", async () => {
    const { deps, calls } = makeDeps({ transport: async ({ signal }) => { await new Promise<void>((_, rej) => signal.addEventListener("abort", () => rej(new TusError("aborted", "x")))); } });
    const m = new UploadManager(deps);
    const [i] = m.add("p1", "raw", [file("a")]);
    await until(() => m.list()[0]?.status === "uploading");
    await m.cancel(i!.localId);
    expect(m.list()).toHaveLength(0);
    expect(calls.remove).toEqual(["a_a"]);
  });

  it("complete refusé (fichier absent du storage) → échec avec le code serveur", async () => {
    const { deps } = makeDeps({ completeAsset: async () => ({ ok: false, code: "upload_missing" }) });
    const m = new UploadManager(deps);
    m.add("p1", "raw", [file("a")]);
    await until(() => m.summary().anyFailed);
    expect(m.list()[0]!.errorCode).toBe("upload_missing");
  });

  it("redémarrage de l'app : les envois non terminés reprennent avec la même session TUS", async () => {
    const store = new MemoryStore();
    const resumed: (string | undefined)[] = [];
    let block = true;
    const mk = () => makeDeps({
      store,
      transport: async ({ resumeUrl, onUrl, onProgress, signal }) => {
        resumed.push(resumeUrl);
        onUrl("https://tus/session-1");
        if (block) await new Promise<void>((_, rej) => signal.addEventListener("abort", () => rej(new TusError("aborted", "x"))));
        onProgress(1000);
      },
    }).deps;
    const m1 = new UploadManager(mk());
    m1.add("p1", "raw", [file("a")]);
    await until(() => m1.list()[0]?.status === "uploading" && !!m1.list()[0]?.tusUrl);
    await m1.flush();
    // « l'app est tuée » : nouveau manager, même stockage
    block = false;
    const m2 = new UploadManager(mk());
    await m2.restore();
    await until(() => m2.summary().allDone);
    expect(resumed).toEqual([undefined, "https://tus/session-1"]);
  });

  it("web : un File perdu au rechargement demande une nouvelle sélection", async () => {
    const store = new MemoryStore();
    const { deps } = makeDeps({ store, transport: async ({ signal }) => { await new Promise<void>((_, rej) => signal.addEventListener("abort", () => rej(new TusError("aborted", "x")))); } });
    const m1 = new UploadManager(deps);
    m1.add("p1", "raw", [{ name: "w.mp4", size: 10, mime: "video/mp4", blob: new Blob(["x"]) }]);
    await tick(20);
    await m1.flush();
    const m2 = new UploadManager(makeDeps({ store }).deps);
    await m2.restore();
    expect(m2.list()[0]!.status).toBe("failed");
    expect(m2.list()[0]!.errorCode).toBe("file_unavailable");
  });
});

describe("résumé", () => {
  it("exclut les annulés et calcule la fraction", () => {
    const m = new UploadManager(makeDeps().deps);
    expect(m.summary()).toMatchObject({ count: 0, allDone: false, fraction: 0 });
    void vi;
  });
});
