import type { PublicSettings } from "@app/config";
import { formatExpiry, isExpired } from "@app/domain";

/**
 * Conservation limitée des fichiers et des vidéos : logique pure (testable sans React Native).
 * Le nombre d'heures vient TOUJOURS des réglages serveur (`retention.raw_hours` / `retention.renders_hours`),
 * jamais d'une valeur écrite dans un texte.
 */

/** En dessous de ce délai restant, l'écran résultat passe en avertissement. */
export const EXPIRY_SOON_HOURS = 3;

export type VersionAvailability = "available" | "expiring" | "expired";

interface Expirable { status: string; expires_at?: string | null }

/**
 * État d'une version vis-à-vis de la conservation :
 * disponible, bientôt supprimée (moins de {@link EXPIRY_SOON_HOURS} h, seulement si elle est prête) ou supprimée.
 * Une date dépassée compte comme supprimée même si le serveur n'a pas encore fini la purge.
 */
export function versionAvailability(v: Expirable, now: Date = new Date()): VersionAvailability {
  if (isExpired(v, now)) return "expired";
  if (v.status !== "ready" || !v.expires_at) return "available";
  const left = new Date(v.expires_at).getTime() - now.getTime();
  if (Number.isFinite(left) && left < EXPIRY_SOON_HOURS * 3_600_000) return "expiring";
  return "available";
}

/** Bandeau de la page résultat (jamais de nombre d'heures : c'est la date qui compte). */
export function expiryBannerText(expiresAtIso: string, now: Date = new Date()): string {
  return `Disponible jusqu'à ${formatExpiry(expiresAtIso, now)}. Téléchargez-la avant : elle est ensuite supprimée.`;
}

export interface RetentionHours { raw: number; renders: number }

export function retentionHours(settings: Pick<PublicSettings, "retention.raw_hours" | "retention.renders_hours">): RetentionHours {
  return { raw: settings["retention.raw_hours"], renders: settings["retention.renders_hours"] };
}

export const hoursLabel = (n: number): string => `${n} h`;

/** Écran d'envoi, sous la zone d'ajout. */
export function uploadRetentionCaption(rawHours: number): string {
  return `Vos fichiers sont supprimés ${hoursLabel(rawHours)} après leur envoi.`;
}

/** Reprise d'un brouillon dont les fichiers ont été supprimés. */
export function purgedDraftMessage(rawHours: number): string {
  return `Vos fichiers précédents ont été supprimés (conservation ${hoursLabel(rawHours)}). Ajoutez-les à nouveau.`;
}

/**
 * Le brouillon serveur fait foi : un fichier marqué supprimé alors qu'il a dépassé la durée de conservation
 * a été purgé (un fichier retiré à la main par le client est forcément plus récent).
 */
export function hasPurgedFiles(
  assets: readonly { status: string; created_at: string }[], rawHours: number, now: Date = new Date(),
): boolean {
  const limit = rawHours * 3_600_000;
  return assets.some((a) => a.status === "deleted" && now.getTime() - new Date(a.created_at).getTime() >= limit);
}

/** Récapitulatif, sous le bouton. */
export function summaryRetentionLine(rendersHours: number): string {
  return `Votre vidéo reste téléchargeable pendant ${hoursLabel(rendersHours)}.`;
}

/** Suivi, une fois la création terminée. */
export function readyDownloadMessage(rendersHours: number): string {
  return `Votre vidéo est prête — téléchargez-la dans les ${hoursLabel(rendersHours)}.`;
}

/** Page résultat quand la vidéo n'existe plus. */
export const EXPIRED_TITLE = "Cette vidéo n'est plus disponible.";
export function expiredBody(rendersHours: number): string {
  return `Pour votre confidentialité, les vidéos sont supprimées ${hoursLabel(rendersHours)} après leur création.`;
}

/** FAQ et Confidentialité : « Combien de temps mes fichiers sont-ils conservés ? » */
export const RETENTION_QUESTION = "Combien de temps mes fichiers sont-ils conservés ?";
export function retentionAnswer(h: RetentionHours): string {
  const files = h.raw === h.renders
    ? `Les fichiers que vous envoyez et les vidéos que nous produisons sont supprimés ${hoursLabel(h.raw)} après leur envoi ou leur création.`
    : `Les fichiers que vous envoyez sont supprimés ${hoursLabel(h.raw)} après leur envoi, et les vidéos produites ${hoursLabel(h.renders)} après leur création.`;
  return `${files} Pensez à télécharger votre vidéo avant : passé ce délai, nous ne pouvons plus la récupérer. Les justificatifs de paiement sont conservés pour la comptabilité, sans lien avec votre identité.`;
}
