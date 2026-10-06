/**
 * Clés d'idempotence (§55). Une clé est créée UNE fois par intention de
 * l'utilisateur (ex. à l'ouverture du récapitulatif) puis réutilisée pour tout
 * retry/double clic : le serveur renvoie alors le même résultat.
 */
let generator: () => string = () => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** Permet à l'app native d'injecter un générateur cryptographique (expo-crypto). */
export function setIdempotencyGenerator(fn: () => string): void { generator = fn; }

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${generator()}`;
}
