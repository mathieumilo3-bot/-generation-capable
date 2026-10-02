import type { ZodType } from "zod";

/**
 * Extrait le premier bloc JSON d'une réponse LLM et le valide contre un
 * schéma zod. Ne jamais faire confiance à la sortie brute : si le
 * parsing ou la validation échoue, on lève — l'appelant doit basculer sur
 * son repli déterministe plutôt que de propager une donnée non fiable
 * (§11 du brief : pas d'hallucination silencieuse).
 */
export function parseAndValidateJson<T>(rawText: string, schema: ZodType<T, any, any>): T {
  const jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Aucun JSON trouvé dans la réponse du modèle.");
  const parsed: unknown = JSON.parse(jsonMatch[0]);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Sortie du modèle invalide contre le schéma: ${result.error.message}`);
  }
  return result.data;
}
