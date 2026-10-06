import { isActiveJob } from "@app/domain";
import type { JobRow, ProjectRow, VersionRow } from "@app/api";

/** Logique pure de la page résultat (testable sans React Native). */

export function isPlayable(v: VersionRow): boolean {
  return v.status === "ready" && !!v.render_path;
}

/** Version à lire par défaut : la version courante si prête, sinon la plus récente prête. */
export function pickInitialVersion(project: Pick<ProjectRow, "current_version_id">, versions: readonly VersionRow[]): VersionRow | null {
  const playable = versions.filter(isPlayable);
  const current = playable.find((v) => v.id === project.current_version_id);
  if (current) return current;
  return [...playable].sort((a, b) => b.version_number - a.version_number)[0] ?? null;
}

export function versionLabel(n: number): string {
  return `Version ${n}`;
}

export function activeJobOf(jobs: readonly JobRow[]): JobRow | undefined {
  return jobs.find((j) => isActiveJob(j.status));
}

/** Dernier échec s'il n'existe aucune version à lire (premier rendu raté). */
export function failedJobOf(jobs: readonly JobRow[], versions: readonly VersionRow[]): JobRow | undefined {
  if (versions.some(isPlayable)) return undefined;
  const latest = jobs[0];
  return latest && latest.status === "failed" ? latest : undefined;
}

/** Nom de fichier propre pour le téléchargement : « Mon-voyage-v2.mp4 ». */
export function downloadFileName(title: string, versionNumber: number): string {
  const base = title
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "video"}-v${versionNumber}.mp4`;
}

/** Ratio largeur/hauteur du lecteur (vertical 9:16 par défaut, borné pour rester lisible). */
export function playerAspect(v: Pick<VersionRow, "width" | "height"> | null | undefined): number {
  if (!v?.width || !v.height) return 9 / 16;
  return Math.min(Math.max(v.width / v.height, 9 / 16), 16 / 9);
}

export function titleForRename(input: string): string | null {
  const t = input.trim().replace(/\s+/g, " ");
  return t.length === 0 ? null : t.slice(0, 120);
}
