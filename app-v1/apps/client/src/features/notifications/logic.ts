import { parseDeepLink, routeForDeepLink } from "@app/domain";

/** Destination d'une notification (centre interne ET tap sur une notification push). */

const INTERNAL = /^\/(project|processing|account|notifications|create|projects)(\/[\w-]+)*(\?[\w=&%.-]*)?$/;

export function routeForNotificationData(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const link = typeof data.deep_link === "string" ? data.deep_link.trim() : "";
  if (link) {
    if (link.startsWith("/") && !link.startsWith("//") && !link.includes("..") && INTERNAL.test(link)) return link;
    const url = link.startsWith("/") ? `https://x.invalid${link}` : link;
    const route = routeForDeepLink(parseDeepLink(url));
    if (route) return route;
  }
  if (typeof data.project_id === "string" && /^[\w-]{8,64}$/.test(data.project_id)) return `/project/${data.project_id}`;
  if (typeof data.job_id === "string" && /^[\w-]{8,64}$/.test(data.job_id)) return `/processing/${data.job_id}`;
  return null;
}

export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const ms = now.getTime() - d.getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
