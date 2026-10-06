import type { PublicSettings } from "@app/config";

/**
 * Les modifications de vidéo (« Modifier », « Créer une nouvelle version ») sont pilotées par le réglage serveur
 * `features.revisions`. Tout le code reste en place ; seul ce réglage décide s'il est visible et atteignable.
 */

export function revisionsEnabled(settings: Pick<PublicSettings, "features.revisions">): boolean {
  return settings["features.revisions"] === true;
}

/** Bouton « Modifier » : réglage actif, moteur compatible, une version lisible, aucune création en cours. */
export function canOfferRevision(o: { settingEnabled: boolean; engineEnabled: boolean; hasPlayableVersion: boolean; hasActiveJob: boolean }): boolean {
  return o.settingEnabled && o.engineEnabled && o.hasPlayableVersion && !o.hasActiveJob;
}

/** Liste des versions : seulement si les modifications existent ET s'il y a vraiment plusieurs versions. */
export function showVersionList(settingEnabled: boolean, versionCount: number): boolean {
  return settingEnabled && versionCount > 1;
}

export type ReviseGuard = "loading" | "allow" | "redirect";

/** Garde de la route `project/[id]/revise` : tant que les réglages ne sont pas chargés on attend, jamais d'accès si le réglage est faux. */
export function reviseGuard(settingsLoaded: boolean, settingEnabled: boolean): ReviseGuard {
  if (!settingsLoaded) return "loading";
  return settingEnabled ? "allow" : "redirect";
}
