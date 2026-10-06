import { describe, expect, it } from "vitest";
import type { EditingMethod } from "@app/domain";
import type { FileRef, UploadItem } from "@app/api";
import {
  INITIAL_DRAFT, canContinueFromStyle, composeBrief, describeRejections, describeUpload, draftReducer, isValidHttpUrl, mergeRows, normalizeUrl, parseDraft,
  pickAutonomousMethod, shortDuration, summarizeRows, summaryLabel, uploadsReady, validateSelection, type UploadLimits,
} from "../src/features/create/logic";

const limits: UploadLimits = { maxFiles: 3, maxFileBytes: 2_000_000_000, maxTotalBytes: 3_000_000_000, allowedMimes: ["video/mp4", "video/quicktime"] };
const file = (name: string, size: number, mime = "video/mp4"): FileRef => ({ name, size, mime, uri: `file:///${name}` });
const item = (over: Partial<UploadItem> & { name?: string; size?: number }): UploadItem => ({
  localId: over.localId ?? "l1", projectId: "p", kind: over.kind ?? "raw",
  file: { name: over.name ?? "a.mp4", size: over.size ?? 1000, mime: "video/mp4" },
  status: over.status ?? "queued", bytesUploaded: over.bytesUploaded ?? 0, attempts: 0, createdAt: 1, assetId: over.assetId, errorCode: over.errorCode,
});
const method = (over: Partial<EditingMethod["capabilities"]>, extra: Partial<EditingMethod> = {}): EditingMethod => ({
  id: "m", slug: "m", name: "M", description: "", advanced: false, recommended: false, sort_order: 1, capabilities: { modes: ["edit_rushes"], ...over }, configuration: {}, ...extra,
});

describe("contrôle des fichiers avant envoi", () => {
  it("accepte des fichiers valides et ignore un doublon exact", () => {
    const r = validateSelection([{ name: "a.mp4", size: 10 }], [file("a.mp4", 10), file("b.mp4", 20)], limits);
    expect(r.accepted.map((f) => f.name)).toEqual(["b.mp4"]);
    expect(r.rejected).toEqual([]);
  });
  it("refuse format, taille et quantités hors limites avec le bon code", () => {
    const r = validateSelection([], [file("x.avi", 10, "video/x-msvideo"), file("big.mp4", 3_000_000_000), file("ok1.mp4", 5), file("ok2.mp4", 6), file("ok3.mp4", 7), file("ok4.mp4", 8)], limits);
    expect(r.rejected).toEqual([
      { name: "x.avi", code: "unsupported_format" }, { name: "big.mp4", code: "file_too_large" }, { name: "ok4.mp4", code: "too_many_files" },
    ]);
    expect(r.accepted).toHaveLength(3);
  });
  it("refuse un dépassement du total", () => {
    const r = validateSelection([], [file("a.mp4", 1_900_000_000), file("b.mp4", 1_500_000_000)], limits);
    expect(r.rejected).toEqual([{ name: "b.mp4", code: "total_too_large" }]);
  });
  it("normalise le type MIME (paramètres, casse)", () => {
    expect(validateSelection([], [file("a.mp4", 5, "Video/MP4; codecs=avc1")], limits).accepted).toHaveLength(1);
  });
  it("explique un refus en français, sans terme technique", () => {
    const e = describeRejections([{ name: "big.mp4", code: "file_too_large" }], limits)!;
    expect(e.title).toMatch(/trop volumineux/);
    expect(e.detail).toContain("big.mp4");
    expect(describeRejections([], limits)).toBeNull();
  });
});

describe("état des envois", () => {
  it("libellés par statut", () => {
    expect(describeUpload({ ...rowOf(item({ status: "uploading", size: 1000, bytesUploaded: 420 })) }).label).toBe("Envoi en cours · 42 %");
    expect(describeUpload(rowOf(item({ status: "done" }))).tone).toBe("success");
    expect(describeUpload(rowOf(item({ status: "paused", errorCode: "offline" }))).label).toMatch(/Hors connexion/);
    expect(describeUpload(rowOf(item({ status: "paused", errorCode: "offline" }))).canRetry).toBe(true);
  });
  it("erreur d'envoi : message humain et reprise", () => {
    const v = describeUpload(rowOf(item({ status: "failed", errorCode: "upload_interrupted" })));
    expect(v.error?.title).toBe("L'envoi s'est interrompu.");
    expect(v.error?.detail).toBe("Votre vidéo est toujours sur votre appareil.");
    expect(v.retryLabel).toBe("Reprendre l'envoi");
    expect(v.canRetry).toBe(true);
  });
  it("pas de reprise pour un refus définitif ou un fichier disparu", () => {
    expect(describeUpload(rowOf(item({ status: "failed", errorCode: "file_too_large" }))).canRetry).toBe(false);
    expect(describeUpload(rowOf(item({ status: "failed", errorCode: "file_unavailable" }))).canRetry).toBe(false);
  });
  it("résumé global « 3 vidéos ajoutées · 428 Mo / 1,2 Go »", () => {
    const rows = mergeRows([
      item({ localId: "1", status: "done", size: 400_000_000 }), item({ localId: "2", status: "done", size: 28_000_000 }), item({ localId: "3", status: "uploading", size: 772_000_000, bytesUploaded: 0 }),
    ], []);
    const s = summarizeRows(rows);
    expect(summaryLabel(s)).toBe("3 vidéos ajoutées · 428 Mo / 1,2 Go");
    expect(s.allDone).toBe(false);
    expect(s.anyActive).toBe(true);
  });
  it("fusionne le brouillon serveur sans doublon avec les envois locaux", () => {
    const rows = mergeRows(
      [item({ localId: "1", status: "done", assetId: "A1" })],
      [{ id: "A1", filename: "a.mp4", size_bytes: 1000, kind: "raw", status: "uploaded" }, { id: "A2", filename: "b.mp4", size_bytes: 2000, kind: "raw", status: "uploaded" }, { id: "A3", filename: "c.mp4", size_bytes: 5, kind: "raw", status: "pending" }],
    );
    expect(rows.map((r) => r.name)).toEqual(["a.mp4", "b.mp4"]);
    expect(uploadsReady(rows)).toBe("ready");
  });
  it("prêt seulement quand tout est arrivé", () => {
    expect(uploadsReady([])).toBe("empty");
    expect(uploadsReady(mergeRows([item({ status: "uploading" })], []))).toBe("pending");
    expect(uploadsReady(mergeRows([item({ status: "failed" }), item({ localId: "2", status: "done" })], []))).toBe("failed");
  });
});

describe("étape Style", () => {
  it("Mode Référence exige au moins une référence", () => {
    const m = method({ requires_references: true });
    expect(canContinueFromStyle(m, { instructions: "", referenceCount: 0 })).toBe(false);
    expect(canContinueFromStyle(m, { instructions: "", referenceCount: 1 })).toBe(true);
  });
  it("Personnalisé exige un texte (la note vocale ne le remplace pas)", () => {
    const m = method({ requires_instructions: true });
    expect(canContinueFromStyle(m, { instructions: "   ", referenceCount: 0 })).toBe(false);
    expect(canContinueFromStyle(m, { instructions: "rythme rapide", referenceCount: 0 })).toBe(true);
  });
  it("Automatique n'exige rien ; sans méthode, on ne continue pas", () => {
    expect(canContinueFromStyle(method({}), { instructions: "", referenceCount: 0 })).toBe(true);
    expect(canContinueFromStyle(undefined, { instructions: "x", referenceCount: 1 })).toBe(false);
  });
});

describe("brouillon du flow", () => {
  it("la clé d'idempotence est refaite quand l'intention change, pas sinon", () => {
    let s = draftReducer(INITIAL_DRAFT, { type: "patch", patch: { projectId: "p", idempotencyKey: "job-1" } });
    s = draftReducer(s, { type: "patch", patch: { idempotencyKey: "job-1" } });
    expect(s.idempotencyKey).toBe("job-1");
    s = draftReducer(s, { type: "patch", patch: { pricingRuleId: "r1" } });
    expect(s.idempotencyKey).toBeNull();
    s = draftReducer(s, { type: "patch", patch: { idempotencyKey: "job-2" } });
    s = draftReducer(s, { type: "patch", patch: { pricingRuleId: "r1" } });
    expect(s.idempotencyKey).toBe("job-2");
    expect(draftReducer(s, { type: "reset" })).toEqual(INITIAL_DRAFT);
  });
  it("relit défensivement un brouillon sérialisé", () => {
    const d = parseDraft(JSON.stringify({ mode: "autonomous", pricingRuleId: "r", methodId: 5, instructions: "x", urls: ["https://a.fr", 3], objective: "sell" }), "p9")!;
    expect(d.projectId).toBe("p9");
    expect(d.mode).toBe("autonomous");
    expect(d.methodId).toBeNull();
    expect(d.urls).toEqual(["https://a.fr"]);
    expect(d.objective).toBe("sell");
    expect(parseDraft("pas du json", "p")).toBeNull();
    expect(parseDraft(null, "p")).toBeNull();
  });
});

describe("création autonome", () => {
  it("le texte transmis ne contient que ce que l'utilisateur a dit", () => {
    expect(composeBrief({ idea: " Une vidéo bougies ", objective: "sell", objectiveDetail: "", urls: ["https://a.fr"] })).toBe("Idée : Une vidéo bougies\nObjectif : Vendre\nLiens : https://a.fr");
    expect(composeBrief({ idea: "x", objective: "other", objectiveDetail: "recruter", urls: [] })).toBe("Idée : x\nObjectif : Autre (recruter)");
    expect(composeBrief({ idea: "x", objective: null, objectiveDetail: "", urls: [] })).toBe("Idée : x");
  });
  it("liens : validation et normalisation", () => {
    expect(isValidHttpUrl("https://monsite.fr/page")).toBe(true);
    expect(isValidHttpUrl("monsite")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(normalizeUrl("monsite.fr")).toBe("https://monsite.fr");
    expect(normalizeUrl("http://monsite.fr")).toBe("http://monsite.fr");
  });
  it("choisit la méthode recommandée non avancée", () => {
    const a = method({}, { id: "a", advanced: true });
    const b = method({}, { id: "b", recommended: true });
    expect(pickAutonomousMethod([a, b])?.id).toBe("b");
    expect(pickAutonomousMethod([])).toBeUndefined();
  });
  it("durée courte", () => {
    expect(shortDuration(30)).toBe("30 s");
    expect(shortDuration(120)).toBe("2 min");
    expect(shortDuration(90)).toBe("90 s");
  });
});

function rowOf(i: UploadItem) { return mergeRows([i], [])[0]!; }
