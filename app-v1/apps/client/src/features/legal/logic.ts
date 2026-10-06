/** Logique pure des liens juridiques et du consentement (testable sans React Native). */

/** Seules les adresses web sont ouvertes (les URLs viennent du serveur : jamais `javascript:` ni autre schéma). */
export function isOpenableUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Clé de déduplication de l'acceptation des conditions : une fois par utilisateur et par version, pour la session. */
export function termsKey(userId: string | null | undefined, version: string | null | undefined): string | null {
  return userId && version ? `${userId}:${version}` : null;
}

export const WAIVER_TEXT = "En lançant la création, vous demandez l'exécution immédiate du service et reconnaissez que vous perdez votre droit de rétractation pour cette vidéo.";
export const SALES_TERMS_LABEL = "Conditions de vente";

// ── Consentement à l'analyse par des services d'IA tiers (récapitulatif) ─────────────────────────────

export const aiConsentKey = (version: string): string => `ai_consent:${version}`;

/** La case n'apparaît que si le réglage est actif ET que le consentement n'a pas encore été donné pour la version courante. */
export function needsAiConsent(o: { enabled: boolean; granted: boolean }): boolean {
  return o.enabled && !o.granted;
}

export function aiConsentLabel(providers: readonly string[]): string {
  const names = providers.map((p) => p.trim()).filter(Boolean).join(", ");
  return `J'autorise l'analyse de mes vidéos par des services d'intelligence artificielle tiers${names ? ` (${names})` : ""} pour réaliser mon montage.`;
}

export const AI_CONSENT_HELP = "Cochez l'autorisation ci-dessus pour pouvoir créer votre vidéo.";

/** Bouton « Créer » actif : conditions habituelles remplies ET (pas de consentement requis, ou case cochée). */
export function canCreateWithConsent(baseOk: boolean, o: { needsConsent: boolean; checked: boolean }): boolean {
  return baseOk && (!o.needsConsent || o.checked);
}
