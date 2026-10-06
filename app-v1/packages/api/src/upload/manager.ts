import type { FileRef, FileSource, KVStore, UploadItem, UploadSummary } from "./types";
import { TusError } from "./tus";

export interface UploadDeps {
  /** Enregistre l'asset côté serveur (chemin choisi par le serveur, limites vérifiées). */
  registerAsset(a: { projectId: string; kind: UploadItem["kind"]; file: FileRef | UploadItem["file"] }): Promise<
    { ok: true; assetId: string; bucket: string; path: string } | { ok: false; code: string }
  >;
  completeAsset(assetId: string): Promise<{ ok: true } | { ok: false; code: string }>;
  removeAsset(assetId: string): Promise<void>;
  /** Envoi TUS d'un fichier vers bucket/path ; lève TusError. */
  transport(a: {
    source: FileSource; bucket: string; path: string; mime: string; resumeUrl?: string;
    onUrl: (u: string) => void; onProgress: (bytes: number) => void; signal: AbortSignal;
  }): Promise<void>;
  /** Plateforme → source de données (web: ref.blob ; mobile: fetch(uri).blob()). */
  resolveSource(file: FileRef | UploadItem["file"]): Promise<FileSource>;
  store: KVStore;
  concurrency?: number;
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  now?: () => number;
}

const STORE_KEY = "uploads:v1";

/**
 * Orchestre les envois : file, 2 en parallèle, reprise automatique, pause hors
 * ligne, annulation, persistance (reprise après redémarrage de l'app).
 * L'état est la source de vérité de l'écran « Ajoutez vos vidéos ».
 */
export class UploadManager {
  private items = new Map<string, UploadItem>();
  private controllers = new Map<string, AbortController>();
  private liveRefs = new Map<string, FileRef>();   // blobs web (non sérialisables)
  private listeners = new Set<() => void>();
  private online = true;
  private paused = false;
  private seq = 0;
  private running = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: UploadDeps) {}

  // ── État ────────────────────────────────────────────────────────────
  list(projectId?: string): UploadItem[] {
    return [...this.items.values()].filter((i) => !projectId || i.projectId === projectId).sort((a, b) => a.createdAt - b.createdAt);
  }

  summary(projectId?: string): UploadSummary {
    const items = this.list(projectId).filter((i) => i.status !== "canceled");
    const bytesTotal = items.reduce((s, i) => s + i.file.size, 0);
    const bytesUploaded = items.reduce((s, i) => s + (i.status === "done" ? i.file.size : Math.min(i.bytesUploaded, i.file.size)), 0);
    const doneCount = items.filter((i) => i.status === "done").length;
    return {
      count: items.length, doneCount, bytesUploaded, bytesTotal,
      allDone: items.length > 0 && doneCount === items.length,
      anyFailed: items.some((i) => i.status === "failed"),
      anyActive: items.some((i) => ["queued", "registering", "uploading", "completing"].includes(i.status)),
      anyPaused: items.some((i) => i.status === "paused"),
      fraction: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0,
    };
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((l) => l()); this.scheduleSave(); }

  // ── Actions ─────────────────────────────────────────────────────────
  add(projectId: string, kind: UploadItem["kind"], files: FileRef[]): UploadItem[] {
    const now = this.deps.now?.() ?? Date.now();
    const added = files.map((f) => {
      const { blob, ...file } = f;
      const item: UploadItem = {
        localId: `up_${now}_${++this.seq}`, projectId, kind, file, status: "queued",
        bytesUploaded: 0, attempts: 0, createdAt: now + this.seq,
      };
      this.items.set(item.localId, item);
      if (blob) this.liveRefs.set(item.localId, { ...f });
      return item;
    });
    this.emit();
    this.pump();
    return added;
  }

  setOnline(online: boolean) {
    this.online = online;
    if (online) {
      for (const i of this.items.values()) if (i.status === "paused") { i.status = "queued"; i.errorCode = undefined; }
      this.emit();
      this.pump();
    } else {
      for (const c of this.controllers.values()) c.abort("offline");
    }
  }

  pauseAll() { this.paused = true; for (const c of this.controllers.values()) c.abort("user_pause"); }
  resumeAll() {
    this.paused = false;
    for (const i of this.items.values()) if (i.status === "paused") i.status = "queued";
    this.emit(); this.pump();
  }

  retry(localId: string) {
    const i = this.items.get(localId);
    if (!i || !["failed", "paused"].includes(i.status)) return;
    i.status = "queued"; i.errorCode = undefined; i.attempts = 0;
    this.emit(); this.pump();
  }

  async cancel(localId: string) {
    const i = this.items.get(localId);
    if (!i) return;
    this.controllers.get(localId)?.abort("canceled");
    i.status = "canceled";
    this.emit();
    if (i.assetId) { try { await this.deps.removeAsset(i.assetId); } catch { /* purgé plus tard par le serveur */ } }
    this.items.delete(localId);
    this.liveRefs.delete(localId);
    this.emit();
  }

  /** Recharge les envois persistés (au démarrage) ; ceux non terminés repartent. */
  async restore(): Promise<void> {
    const raw = await this.deps.store.getItem(STORE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as UploadItem[];
      for (const i of saved) {
        if (this.items.has(i.localId) || i.status === "canceled") continue;
        // Sur le web un File ne survit pas au rechargement : l'utilisateur devra le re-sélectionner.
        const needsFile = !i.file.uri && !this.liveRefs.has(i.localId) && i.status !== "done";
        this.items.set(i.localId, { ...i, status: i.status === "done" ? "done" : needsFile ? "failed" : "queued", errorCode: needsFile ? "file_unavailable" : undefined });
      }
    } catch { /* état corrompu : on repart de zéro */ }
    this.emit(); this.pump();
  }

  /** Oublie les envois terminés d'un projet (après lancement de la vidéo). */
  clearProject(projectId: string) {
    for (const [id, i] of this.items) if (i.projectId === projectId) { this.items.delete(id); this.liveRefs.delete(id); }
    this.emit();
  }

  // ── Moteur ──────────────────────────────────────────────────────────
  private pump() {
    if (!this.online || this.paused) return;
    const limit = this.deps.concurrency ?? 2;
    for (const item of this.list()) {
      if (this.running >= limit) break;
      if (item.status !== "queued") continue;
      this.running++;
      item.status = "registering";
      this.emit();
      void this.run(item).finally(() => { this.running--; this.pump(); });
    }
  }

  private async run(item: UploadItem): Promise<void> {
    const max = this.deps.maxAttempts ?? 4;
    const backoff = this.deps.backoffMs ?? ((n: number) => Math.min(1000 * 2 ** n, 15000));
    const controller = new AbortController();
    this.controllers.set(item.localId, controller);
    try {
      if (!item.assetId) {
        const reg = await this.deps.registerAsset({ projectId: item.projectId, kind: item.kind, file: this.liveRefs.get(item.localId) ?? item.file });
        if (!reg.ok) return this.fail(item, reg.code);
        item.assetId = reg.assetId; item.bucket = reg.bucket; item.path = reg.path;
        this.emit();
      }
      const source = await this.deps.resolveSource(this.liveRefs.get(item.localId) ?? item.file);
      while (item.attempts < max) {
        item.status = "uploading";
        this.emit();
        try {
          await this.deps.transport({
            source, bucket: item.bucket!, path: item.path!, mime: item.file.mime, resumeUrl: item.tusUrl,
            onUrl: (u) => { item.tusUrl = u; this.emit(); },
            onProgress: (b) => { item.bytesUploaded = b; this.emit(); },
            signal: controller.signal,
          });
          break;
        } catch (e) {
          const err = e as TusError;
          if (err.kind === "aborted") {
            const reason = String(controller.signal.reason ?? "");
            if (reason === "canceled") return;
            item.status = "paused"; item.errorCode = reason === "offline" ? "offline" : undefined;
            this.emit();
            return;
          }
          item.attempts++;
          if (err.kind === "fatal" || item.attempts >= max) return this.fail(item, err.kind === "auth" ? "not_authenticated" : "upload_interrupted");
          if (!this.online) { item.status = "paused"; item.errorCode = "offline"; this.emit(); return; }
          await new Promise((r) => setTimeout(r, backoff(item.attempts)));
        }
      }
      if (item.status === "failed") return;
      item.status = "completing"; this.emit();
      const done = await this.deps.completeAsset(item.assetId);
      if (!done.ok) {
        // Le fichier n'est pas (entièrement) arrivé : on repart d'une nouvelle session d'envoi.
        item.tusUrl = undefined; item.bytesUploaded = 0;
        return this.fail(item, done.code);
      }
      item.bytesUploaded = item.file.size; item.status = "done"; item.tusUrl = undefined;
      this.emit();
    } catch (e) {
      const code = (e as { code?: string }).code;
      this.fail(item, typeof code === "string" && code.length > 0 ? code : "network_error");
    } finally {
      this.controllers.delete(item.localId);
    }
  }

  private fail(item: UploadItem, code: string) {
    item.status = "failed"; item.errorCode = code; this.emit();
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const snapshot = [...this.items.values()].filter((i) => i.status !== "canceled");
      void this.deps.store.setItem(STORE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    }, 150);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    await this.deps.store.setItem(STORE_KEY, JSON.stringify([...this.items.values()].filter((i) => i.status !== "canceled")));
  }
}
