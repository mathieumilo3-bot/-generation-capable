/**
 * Contrôle des fichiers : extensions autorisées, taille, signature binaire,
 * noms assainis et chemins de stockage par organisation.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ["pdf", "xlsx", "xls", "csv"] as const;
export type FileKind = (typeof ALLOWED_EXTENSIONS)[number];

export const ACCEPT_ATTRIBUTE = ".pdf,.xlsx,.xls,.csv";

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function fileKind(name: string): FileKind | null {
  const ext = extensionOf(name);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as FileKind) : null;
}

/** Nom sûr pour le stockage : ASCII, sans séparateurs de chemin, 120 caractères max. */
export function sanitizeFileName(name: string): string {
  const baseName = name.split(/[\\/]/).pop() ?? "";
  const ext = extensionOf(baseName);
  const base = baseName
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 100);
  return `${base || "fichier"}${ext ? `.${ext}` : ""}`;
}

/** Nom affichable : on garde les accents mais on retire tout caractère de contrôle. */
export function displayFileName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 255) || "fichier";
}

const SIGNATURES: Record<Exclude<FileKind, "csv">, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  xlsx: [[0x50, 0x4b, 0x03, 0x04]], // ZIP
  xls: [
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE2
    [0x50, 0x4b, 0x03, 0x04], // .xls qui est en réalité un xlsx renommé
  ],
};

/** Vérifie que le contenu correspond à l'extension déclarée. */
export function contentMatchesKind(buffer: Uint8Array, kind: FileKind): boolean {
  if (kind === "csv") {
    const head = buffer.subarray(0, 4096);
    return !head.includes(0);
  }
  if (kind === "pdf") {
    // Certains générateurs ajoutent des octets avant l'en-tête %PDF.
    const head = Buffer.from(buffer.subarray(0, 1024)).toString("latin1");
    return head.includes("%PDF-");
  }
  return SIGNATURES[kind].some((sig) => sig.every((b, i) => buffer[i] === b));
}

/** Détecte le vrai format d'un .xls (souvent un xlsx renommé). */
export function spreadsheetFormat(buffer: Uint8Array, kind: FileKind): "xlsx" | "xls" | "csv" {
  if (kind === "csv") return "csv";
  return buffer[0] === 0x50 && buffer[1] === 0x4b ? "xlsx" : "xls";
}

export type StorageArea = "source" | "consultations" | "responses" | "exports";

export function storagePath(orgId: string, projectId: string, area: StorageArea, fileName: string) {
  return `${orgId}/${projectId}/${area}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

/** Garde-fou : un chemin ne peut appartenir qu'à l'organisation et au dossier attendus. */
export function pathBelongsTo(path: string, orgId: string, projectId: string, area?: StorageArea) {
  const parts = path.split("/");
  if (parts.length !== 4 || parts.some((p) => !p || p === "." || p === "..")) return false;
  return parts[0] === orgId && parts[1] === projectId && (!area || parts[2] === area);
}

export const MIME_BY_KIND: Record<FileKind, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};
