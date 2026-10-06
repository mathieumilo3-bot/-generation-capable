import { formatBytes, humanizeError, pluralize, type CreationMode, type EditingMethod, type HumanError } from "@app/domain";
import type { FileRef, UploadItem, UploadStatus } from "@app/api";

/**
 * Logique pure du flow « Créer » (sans React ni react-native → testable avec vitest).
 */

// ── Brouillon du flow ───────────────────────────────────────────────────

export const OBJECTIVES = [
  { key: "sell", label: "Vendre" },
  { key: "leads", label: "Obtenir des prospects" },
  { key: "present", label: "Présenter un produit" },
  { key: "engage", label: "Créer de l'engagement" },
  { key: "other", label: "Autre" },
] as const;
export type ObjectiveKey = (typeof OBJECTIVES)[number]["key"];

export interface CreateDraft {
  projectId: string | null;
  mode: CreationMode;
  pricingRuleId: string | null;
  methodId: string | null;
  /** Texte du mode Personnalisé. */
  instructions: string;
  /** Une clé par intention : recréée dès que le prix, le style ou le texte change. */
  idempotencyKey: string | null;
  // Création autonome (architecture prête ; atteignable uniquement si capabilities.autonomous_creation).
  idea: string;
  objective: ObjectiveKey | null;
  objectiveDetail: string;
  urls: string[];
}

export const INITIAL_DRAFT: CreateDraft = {
  projectId: null, mode: "edit_rushes", pricingRuleId: null, methodId: null, instructions: "", idempotencyKey: null,
  idea: "", objective: null, objectiveDetail: "", urls: [],
};

export type DraftAction =
  | { type: "reset" }
  | { type: "hydrate"; draft: CreateDraft }
  | { type: "patch"; patch: Partial<CreateDraft> };

const INTENT_KEYS: (keyof CreateDraft)[] = ["mode", "pricingRuleId", "methodId", "instructions", "idea", "objective", "objectiveDetail", "urls"];

export function draftReducer(state: CreateDraft, action: DraftAction): CreateDraft {
  switch (action.type) {
    case "reset": return INITIAL_DRAFT;
    case "hydrate": return action.draft;
    case "patch": {
      const next = { ...state, ...action.patch };
      const intentChanged = INTENT_KEYS.some((k) => k in action.patch && JSON.stringify(action.patch[k]) !== JSON.stringify(state[k]));
      if (intentChanged && !("idempotencyKey" in action.patch)) next.idempotencyKey = null;
      return next;
    }
  }
}

/** Lecture défensive d'un brouillon sérialisé (stockage local potentiellement ancien ou corrompu). */
export function parseDraft(json: string | null, projectId: string): CreateDraft | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
    const objective = OBJECTIVES.find((o) => o.key === v.objective)?.key ?? null;
    return {
      projectId,
      mode: v.mode === "autonomous" ? "autonomous" : "edit_rushes",
      pricingRuleId: str(v.pricingRuleId),
      methodId: str(v.methodId),
      instructions: str(v.instructions) ?? "",
      idempotencyKey: str(v.idempotencyKey),
      idea: str(v.idea) ?? "",
      objective,
      objectiveDetail: str(v.objectiveDetail) ?? "",
      urls: Array.isArray(v.urls) ? v.urls.filter((u): u is string => typeof u === "string").slice(0, 10) : [],
    };
  } catch {
    return null;
  }
}

export const draftStorageKey = (projectId: string) => `create:draft:${projectId}`;

// ── Fichiers ────────────────────────────────────────────────────────────

export interface UploadLimits { maxFiles: number; maxFileBytes: number; maxTotalBytes: number; allowedMimes: readonly string[] }
export interface Rejection { name: string; code: string }

const baseMime = (m: string) => m.split(";")[0]!.trim().toLowerCase();

/**
 * Contrôles rapides avant envoi (le serveur reste l'autorité). Un doublon exact (nom + taille) est ignoré en silence.
 */
export function validateSelection(
  existing: readonly { name: string; size: number }[],
  picked: readonly FileRef[],
  limits: UploadLimits,
): { accepted: FileRef[]; rejected: Rejection[] } {
  const accepted: FileRef[] = [];
  const rejected: Rejection[] = [];
  let count = existing.length;
  let total = existing.reduce((s, f) => s + f.size, 0);
  const seen = new Set(existing.map((f) => `${f.name}:${f.size}`));
  for (const f of picked) {
    const id = `${f.name}:${f.size}`;
    if (seen.has(id)) continue;
    if (!limits.allowedMimes.includes(baseMime(f.mime))) { rejected.push({ name: f.name, code: "unsupported_format" }); continue; }
    if (f.size > limits.maxFileBytes) { rejected.push({ name: f.name, code: "file_too_large" }); continue; }
    if (count + 1 > limits.maxFiles) { rejected.push({ name: f.name, code: "too_many_files" }); continue; }
    if (total + f.size > limits.maxTotalBytes) { rejected.push({ name: f.name, code: "total_too_large" }); continue; }
    accepted.push(f); seen.add(id); count++; total += f.size;
  }
  return { accepted, rejected };
}

export function describeRejections(rejected: readonly Rejection[], limits: UploadLimits): HumanError | null {
  const first = rejected[0];
  if (!first) return null;
  const h = humanizeError(first.code, { maxFiles: limits.maxFiles, maxBytes: limits.maxFileBytes });
  const extra = rejected.length > 1 ? ` (${pluralize(rejected.length, "fichier refusé", "fichiers refusés")})` : "";
  return { ...h, title: `${h.title}${extra}`, detail: `${first.name} : ${h.detail}`, action: "none", actionLabel: null };
}

export type RowStatus = UploadStatus | "server";

/** Ligne affichée : un envoi local OU un fichier déjà présent sur le brouillon serveur (source de vérité). */
export interface FileRow {
  key: string;
  source: "local" | "server";
  localId?: string;
  assetId?: string;
  name: string;
  size: number;
  kind: UploadItem["kind"];
  status: RowStatus;
  bytesUploaded: number;
  errorCode?: string;
}

export function rowFromUpload(i: UploadItem): FileRow {
  return { key: i.localId, source: "local", localId: i.localId, assetId: i.assetId, name: i.file.name, size: i.file.size, kind: i.kind, status: i.status, bytesUploaded: i.bytesUploaded, errorCode: i.errorCode };
}

export function rowFromServerAsset(a: { id: string; filename: string; size_bytes: number; kind: UploadItem["kind"] }): FileRow {
  return { key: `srv_${a.id}`, source: "server", assetId: a.id, name: a.filename, size: a.size_bytes, kind: a.kind, status: "server", bytesUploaded: a.size_bytes };
}

/** Fichiers locaux + fichiers du brouillon serveur absents des envois locaux. */
export function mergeRows(local: readonly UploadItem[], server: readonly { id: string; filename: string; size_bytes: number; kind: UploadItem["kind"]; status: string }[]): FileRow[] {
  const known = new Set(local.map((i) => i.assetId).filter((x): x is string => !!x));
  const rows = local.filter((i) => i.status !== "canceled").map(rowFromUpload);
  for (const a of server) if (a.status === "uploaded" && !known.has(a.id)) rows.push(rowFromServerAsset(a));
  return rows;
}

const NON_RETRYABLE = new Set(["file_unavailable", "file_too_large", "unsupported_format", "too_many_files", "total_too_large", "project_locked", "invalid_kind"]);

export interface UploadView {
  label: string;
  tone: "progress" | "success" | "error" | "neutral" | "warning";
  /** 0..1, null = indéterminé, undefined = pas de barre. */
  progress: number | null | undefined;
  error: HumanError | null;
  canRetry: boolean;
  retryLabel: string | null;
}

export function describeUpload(row: FileRow): UploadView {
  const fraction = row.size > 0 ? Math.min(1, row.bytesUploaded / row.size) : 0;
  switch (row.status) {
    case "server": case "done":
      return { label: "Envoyé", tone: "success", progress: undefined, error: null, canRetry: false, retryLabel: null };
    case "queued":
      return { label: "En attente", tone: "neutral", progress: 0, error: null, canRetry: false, retryLabel: null };
    case "registering":
      return { label: "Préparation de l'envoi…", tone: "progress", progress: null, error: null, canRetry: false, retryLabel: null };
    case "uploading":
      return { label: `Envoi en cours · ${Math.floor(fraction * 100)} %`, tone: "progress", progress: fraction, error: null, canRetry: false, retryLabel: null };
    case "completing":
      return { label: "Finalisation…", tone: "progress", progress: 1, error: null, canRetry: false, retryLabel: null };
    case "paused":
      return {
        label: row.errorCode === "offline" ? "Hors connexion · l'envoi reprendra tout seul" : "En pause",
        tone: "warning", progress: fraction, error: null, canRetry: true, retryLabel: "Reprendre",
      };
    case "failed": {
      if (row.errorCode === "file_unavailable") {
        return {
          label: "À renvoyer", tone: "error", progress: undefined, canRetry: false, retryLabel: null,
          error: { title: "Ce fichier n'est plus disponible.", detail: "Retirez-le puis sélectionnez-le à nouveau.", money: null, action: "none", actionLabel: null },
        };
      }
      const code = row.errorCode && row.errorCode !== "unknown" ? row.errorCode : "upload_interrupted";
      const h = humanizeError(code);
      const retry = !NON_RETRYABLE.has(code);
      return { label: "Envoi interrompu", tone: "error", progress: undefined, error: h, canRetry: retry, retryLabel: retry ? "Reprendre l'envoi" : null };
    }
    case "canceled":
      return { label: "Annulé", tone: "neutral", progress: undefined, error: null, canRetry: false, retryLabel: null };
  }
}

export interface FilesSummary {
  count: number; doneCount: number; bytesUploaded: number; bytesTotal: number;
  allDone: boolean; anyFailed: boolean; anyActive: boolean; fraction: number;
}

const ACTIVE: RowStatus[] = ["queued", "registering", "uploading", "completing", "paused"];

export function summarizeRows(rows: readonly FileRow[]): FilesSummary {
  const bytesTotal = rows.reduce((s, r) => s + r.size, 0);
  const bytesUploaded = rows.reduce((s, r) => s + (r.status === "done" || r.status === "server" ? r.size : Math.min(r.bytesUploaded, r.size)), 0);
  const doneCount = rows.filter((r) => r.status === "done" || r.status === "server").length;
  return {
    count: rows.length, doneCount, bytesUploaded, bytesTotal,
    allDone: rows.length > 0 && doneCount === rows.length,
    anyFailed: rows.some((r) => r.status === "failed"),
    anyActive: rows.some((r) => ACTIVE.includes(r.status)),
    fraction: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0,
  };
}

/** « 3 vidéos ajoutées · 428 Mo / 1,2 Go » (§14). */
export function summaryLabel(s: Pick<FilesSummary, "count" | "bytesUploaded" | "bytesTotal">, noun: { one: string; many: string } = { one: "vidéo ajoutée", many: "vidéos ajoutées" }): string {
  return `${pluralize(s.count, noun.one, noun.many)} · ${formatBytes(s.bytesUploaded)} / ${formatBytes(s.bytesTotal)}`;
}

// ── Étapes et validations ───────────────────────────────────────────────

/** Les fichiers (hors échec) sont-ils tous arrivés ? Le serveur refuse sinon (`uploads_incomplete`). */
export function uploadsReady(rows: readonly FileRow[]): "ready" | "pending" | "failed" | "empty" {
  if (rows.length === 0) return "empty";
  const s = summarizeRows(rows);
  if (s.anyFailed) return "failed";
  return s.allDone ? "ready" : "pending";
}

/** Peut-on passer à l'étape suivante depuis « Style » ? */
export function canContinueFromStyle(method: EditingMethod | undefined, o: { instructions: string; referenceCount: number }): boolean {
  if (!method) return false;
  if (method.capabilities.requires_references && o.referenceCount < 1) return false;
  if (method.capabilities.requires_instructions && o.instructions.trim().length === 0) return false;
  return true;
}

export function aspectLabel(ratio: string): string {
  if (ratio === "9:16") return "Vertical 9:16";
  if (ratio === "16:9") return "Horizontal 16:9";
  if (ratio === "1:1") return "Carré 1:1";
  return ratio;
}

export function creationTypeLabel(mode: CreationMode): string {
  return mode === "autonomous" ? "Création à partir de votre idée" : "Montage de vos vidéos";
}

export function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function normalizeUrl(input: string): string {
  const t = input.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Texte transmis au moteur pour la création autonome : seulement ce que l'utilisateur a dit.
 * Rien d'autre n'est demandé (format, style, musique : le moteur déduit).
 */
export function composeBrief(a: { idea: string; objective: ObjectiveKey | null; objectiveDetail: string; urls: readonly string[] }): string {
  const lines = [`Idée : ${a.idea.trim().slice(0, 1500)}`];
  const obj = OBJECTIVES.find((o) => o.key === a.objective);
  if (obj) {
    const detail = a.objective === "other" ? a.objectiveDetail.trim().slice(0, 200) : "";
    lines.push(`Objectif : ${detail ? `${obj.label} (${detail})` : obj.label}`);
  }
  if (a.urls.length > 0) lines.push(`Liens : ${a.urls.join(", ")}`);
  return lines.join("\n");
}

export function pickAutonomousMethod(methods: readonly EditingMethod[]): EditingMethod | undefined {
  return methods.find((m) => m.recommended && !m.advanced) ?? methods.find((m) => !m.advanced) ?? methods[0];
}

/** Durée max affichable : 30 → « 30 s », 120 → « 2 min ». */
export function shortDuration(sec: number): string {
  return sec < 60 || sec % 60 !== 0 ? `${sec} s` : `${sec / 60} min`;
}
