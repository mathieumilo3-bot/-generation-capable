import type { ProjectRow } from "@app/api";
import { isExpired } from "@app/domain";

/** Logique pure des listes de projets (testable sans React Native). */

export type ProjectFilter = "all" | "active" | "done";

export const PROJECT_FILTERS: { key: ProjectFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "En cours" },
  { key: "done", label: "Terminés" },
];

export const PAGE_SIZE = 24;

/** Curseur de la page suivante : `created_at` du dernier projet, seulement si la page était pleine. */
export function nextCursor(lastPage: readonly ProjectRow[], pageSize = PAGE_SIZE): string | undefined {
  if (lastPage.length < pageSize) return undefined;
  return lastPage[lastPage.length - 1]?.created_at;
}

/** Nombre de colonnes de la grille selon la largeur disponible (2 sur téléphone, 3 sur tablette/web). */
export function columnsForWidth(width: number): number {
  if (width >= 560) return 3;
  return 2;
}

/** Complète la dernière ligne avec des cases vides pour que les cartes gardent la même largeur. */
export function padGrid<T>(items: readonly T[], columns: number): (T | null)[] {
  const out: (T | null)[] = [...items];
  const rest = items.length % columns;
  if (rest !== 0) for (let i = 0; i < columns - rest; i++) out.push(null);
  return out;
}

export function projectTitle(p: { title: string }): string {
  const t = p.title.trim();
  return t.length > 0 ? t : "Sans titre";
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** « Aujourd'hui », « Hier », « 12 mars », « 12 mars 2025 ». */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export type BadgeTone = "progress" | "success" | "error" | "neutral";

/** Statut d'un projet pour les cartes (le statut du projet fait foi ; « Expirée » = la vidéo a été supprimée). */
export function projectBadge(status: ProjectRow["status"], expired = false): { label: string; tone: BadgeTone } {
  switch (status) {
    case "processing": return { label: "En cours", tone: "progress" };
    case "ready": return expired ? { label: "Expirée", tone: "neutral" } : { label: "Terminé", tone: "success" };
    case "failed": return { label: "Échec", tone: "error" };
    case "draft": return { label: "Brouillon", tone: "neutral" };
    default: return { label: "Archivé", tone: "neutral" };
  }
}

/** Chemins de miniatures à signer : jamais pour un projet expiré (la miniature a été supprimée avec la vidéo). */
export function thumbnailPaths(
  projects: readonly { id?: string; thumbnail_path: string | null }[], expiredIds?: ReadonlySet<string>,
): string[] {
  return Array.from(new Set(projects.flatMap((p) => (p.thumbnail_path && !(p.id && expiredIds?.has(p.id)) ? [p.thumbnail_path] : []))));
}

/** Projets dont la vidéo courante n'existe plus, d'après les versions lues (état serveur ou date dépassée). */
export function expiredProjectIds(
  projects: readonly Pick<ProjectRow, "id" | "status" | "current_version_id">[],
  versions: readonly { id: string; status: string; expires_at: string | null }[],
  now: Date = new Date(),
): Set<string> {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const out = new Set<string>();
  for (const p of projects) {
    const v = p.status === "ready" && p.current_version_id ? byId.get(p.current_version_id) : undefined;
    if (v && isExpired(v, now)) out.add(p.id);
  }
  return out;
}

/** Libellé lu par les lecteurs d'écran pour une carte de projet. */
export function projectA11yLabel(p: ProjectRow, now: Date = new Date(), expired = false): string {
  return `${projectTitle(p)}, ${projectBadge(p.status, expired).label}, ${formatRelativeDate(p.created_at, now)}`;
}

export const SEARCH_DEBOUNCE_MS = 300;
