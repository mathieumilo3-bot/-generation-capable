/**
 * Les URLs de téléchargement viennent d'une réponse JSON distante : on
 * n'accepte que du HTTPS vers les CDN Apple, pour qu'une réponse
 * falsifiée ne puisse pas faire télécharger (ni requêter) autre chose au
 * serveur.
 */
export function isTrustedIcloudUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host.endsWith(".icloud-content.com") || host.endsWith(".icloud.com") || host.endsWith(".apple.com");
  } catch {
    return false;
  }
}
