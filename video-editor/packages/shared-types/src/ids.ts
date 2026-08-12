import { randomUUID } from "node:crypto";

/**
 * Tous les identifiants du système sont des UUID v4 préfixés par domaine
 * (proj_, rush_, seg_...) pour rester lisibles dans les logs et le
 * cost_ledger sans avoir à joindre les tables pour savoir de quoi on parle.
 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
