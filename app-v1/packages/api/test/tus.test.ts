import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeTus, type FakeTus } from "./fake-tus-server";
import { TusError, tusUpload, type FileSource } from "../src/index";

const MB = 1024 * 1024;
const makeFile = (size: number): { source: FileSource; bytes: Buffer } => {
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) % 251;
  const blob = new Blob([bytes]);
  return { source: { size, slice: (s, e) => blob.slice(s, e) }, bytes };
};
const noSleep = async () => undefined;
let srv: FakeTus;
beforeEach(async () => { srv = await startFakeTus(); });
afterEach(async () => { await srv.close(); });
const base = () => ({ endpoint: srv.url, headers: async () => ({}), metadata: { bucketName: "raw", objectName: "u/p/a/x.mp4" }, chunkSize: 2 * MB, sleep: noSleep });
const received = (): Buffer => Buffer.concat([...srv.uploads.values()][0]!.data);

describe("tusUpload", () => {
  it("envoie un fichier multi-morceaux à l'identique", async () => {
    const { source, bytes } = makeFile(5 * MB + 123);
    const progress: number[] = [];
    await tusUpload({ ...base(), file: source, onProgress: (b) => progress.push(b) });
    expect(received().equals(bytes)).toBe(true);
    expect(progress.at(-1)).toBe(source.size);
    expect(srv.stats.creates).toBe(1);
  });

  it("coupure réseau en plein morceau : reprend à l'offset du serveur, sans tout renvoyer", async () => {
    const { source, bytes } = makeFile(6 * MB);
    srv.dropOnPatch(2, 700_000);   // 2e morceau coupé après ~0,7 Mo
    await tusUpload({ ...base(), file: source });
    expect(received().equals(bytes)).toBe(true);
    expect(srv.stats.creates).toBe(1);
    expect(srv.stats.bytesReceived).toBe(source.size);  // aucun octet reçu deux fois
    expect(srv.stats.heads).toBeGreaterThan(0);
  });

  it("erreur serveur 503 temporaire : retry puis succès", async () => {
    const { source, bytes } = makeFile(3 * MB);
    srv.failOnPatch(1, 503);
    await tusUpload({ ...base(), file: source });
    expect(received().equals(bytes)).toBe(true);
  });

  it("reprise après redémarrage de l'app (resumeUrl) : n'envoie que le reste", async () => {
    const { source, bytes } = makeFile(6 * MB);
    const ctl = new AbortController();
    let url = "";
    await expect(tusUpload({
      ...base(), file: source, signal: ctl.signal, onUrl: (u) => { url = u; },
      onProgress: (b) => { if (b >= 2 * MB) ctl.abort(); },
    })).rejects.toMatchObject({ kind: "aborted" });
    const sentBefore = srv.stats.bytesReceived;
    expect(sentBefore).toBeGreaterThanOrEqual(2 * MB);
    expect(sentBefore).toBeLessThan(source.size);
    await tusUpload({ ...base(), file: source, resumeUrl: url });
    expect(received().equals(bytes)).toBe(true);
    expect(srv.stats.creates).toBe(1);
    expect(srv.stats.bytesReceived).toBe(source.size);
  });

  it("session expirée côté serveur : repart proprement sur une nouvelle session", async () => {
    const { source, bytes } = makeFile(3 * MB);
    let url = "";
    await tusUpload({ ...base(), file: makeFile(1 * MB).source, onUrl: (u) => { url = u; } });
    srv.expireAll();
    await tusUpload({ ...base(), file: source, resumeUrl: url });
    expect(received().equals(bytes)).toBe(true);
  });

  it("jeton expiré : une ré-authentification, puis succès", async () => {
    const { source } = makeFile(1 * MB);
    srv.rejectAuth(1);
    await tusUpload({ ...base(), file: source });
    expect(srv.stats.creates).toBe(1);
  });

  it("auth refusée durablement → erreur 'auth'", async () => {
    srv.rejectAuth(50);
    await expect(tusUpload({ ...base(), file: makeFile(MB).source })).rejects.toMatchObject({ kind: "auth" });
  });

  it("serveur injoignable → erreur réseau après les retries", async () => {
    await srv.close();
    await expect(tusUpload({ ...base(), file: makeFile(MB).source, retryDelays: [0, 0] })).rejects.toMatchObject({ kind: "network" });
    srv = await startFakeTus();
  });

  it("annulation immédiate", async () => {
    const ctl = new AbortController(); ctl.abort();
    await expect(tusUpload({ ...base(), file: makeFile(MB).source, signal: ctl.signal })).rejects.toBeInstanceOf(TusError);
  });

  it("refuse un fichier vide", async () => {
    await expect(tusUpload({ ...base(), file: { size: 0, slice: () => new Blob([]) } })).rejects.toMatchObject({ kind: "fatal" });
  });
});
