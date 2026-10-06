import type { ProjectRow } from "@app/api";

/** Logique pure de l'accueil (testable sans React Native). */

export function greetingText(firstName: string | null | undefined): string {
  const n = firstName?.trim();
  return n ? `Bonjour, ${n}` : "Bonjour";
}

export const RECENT_COUNT = 6;

export function recentProjects(projects: readonly ProjectRow[], n = RECENT_COUNT): ProjectRow[] {
  return projects.filter((p) => p.status !== "draft").slice(0, n);
}

export function activeJobTitle(job: { project_title?: string | null }): string {
  const t = job.project_title?.trim();
  return t ? t : "Votre vidéo";
}

export function unreadBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

export function unreadA11y(count: number): string {
  if (count <= 0) return "Notifications";
  return `Notifications, ${count} non lue${count > 1 ? "s" : ""}`;
}
