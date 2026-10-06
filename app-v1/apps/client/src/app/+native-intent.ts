import { parseDeepLink, routeForDeepLink } from "@app/domain";

/**
 * Traduit les liens entrants (schéma natif ET Universal/App Links) vers les routes Expo Router (§48).
 * Les liens inconnus ou malformés sont ignorés (retour accueil) plutôt qu'interprétés.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = path.startsWith("http") || path.includes("://") ? path : `https://x.invalid${path.startsWith("/") ? "" : "/"}${path}`;
    const link = parseDeepLink(url);
    if (link.type === "auth_callback") return "/auth/callback" + (path.includes("?") ? path.slice(path.indexOf("?")) : path.includes("#") ? path.slice(path.indexOf("#")) : "");
    return routeForDeepLink(link) ?? "/";
  } catch {
    return "/";
  }
}
