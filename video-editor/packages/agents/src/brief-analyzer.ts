import { BriefSpecSchema, type BriefSpec } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { ModelRouter } from "@video-editor/model-router";
import { recordProviderCall } from "@video-editor/cost-ledger";
import { parseAndValidateJson } from "./llm-json.js";

const SYSTEM_PROMPT = `Tu es le Brief Analyzer d'un monteur vidéo IA. Tu transformes un brief en
langage naturel en spécification JSON stricte. Réponds UNIQUEMENT avec un
objet JSON valide, aucun texte autour, respectant exactement ce schéma :
{
  "objective": string, "audience": string,
  "platform": "tiktok"|"instagram_reels"|"youtube_shorts"|"generic_vertical",
  "targetDurationSec": number (15-180), "tone": string, "style": string,
  "cta": string (optionnel), "dynamism": number (0-1), "constraints": string[]
}`;

/**
 * Agent 01 — Brief Analyzer. Chemin réel : LLM avec sortie JSON stricte.
 * Repli déterministe (aucune clé LLM) : extraction par mots-clés — moins
 * fin, mais garantit que le pipeline tourne de bout en bout dès
 * aujourd'hui, conformément au principe §22 du brief ("règle
 * déterministe plutôt qu'IA absente").
 */
export async function runBriefAnalyzer(
  db: Db,
  router: ModelRouter,
  projectId: string,
  rawText: string
): Promise<BriefSpec> {
  if (router.capabilities.llm) {
    try {
      const result = await router.llm.complete({ system: SYSTEM_PROMPT, prompt: rawText, maxTokens: 600 });
      recordProviderCall(db, { projectId, agent: "brief_analyzer", stage: "brief_analysis", result });
      return parseAndValidateJson(result.data, BriefSpecSchema);
    } catch (err) {
      // on tombe sur le repli déterministe plutôt que de faire échouer tout le pipeline sur une panne fournisseur ponctuelle
      console.warn(`[brief_analyzer] LLM indisponible/invalide, repli heuristique: ${(err as Error).message}`);
    }
  }
  return heuristicBriefSpec(rawText);
}

const PLATFORM_KEYWORDS: [RegExp, BriefSpec["platform"]][] = [
  [/tiktok/i, "tiktok"],
  [/reels?|instagram/i, "instagram_reels"],
  [/shorts?|youtube/i, "youtube_shorts"],
];

function heuristicBriefSpec(rawText: string): BriefSpec {
  const platform = PLATFORM_KEYWORDS.find(([re]) => re.test(rawText))?.[1] ?? "generic_vertical";

  const secMatch = rawText.match(/(\d+)\s*(secondes?|sec\b|s\b)/i);
  const minMatch = rawText.match(/(\d+)\s*(minutes?|min\b)/i);
  let targetDurationSec = 45;
  if (secMatch) targetDurationSec = parseInt(secMatch[1]!, 10);
  else if (minMatch) targetDurationSec = parseInt(minMatch[1]!, 10) * 60;
  targetDurationSec = Math.max(15, Math.min(180, targetDurationSec));

  const dynamicWords = /dynamique|énergique|hype|rapide|punchy|agressif/i;
  const calmWords = /premium|épuré|calme|posé|minimal|sobre/i;
  let dynamism = 0.5;
  if (dynamicWords.test(rawText)) dynamism = 0.75;
  if (calmWords.test(rawText)) dynamism = 0.3;

  const constraints: string[] = [];
  for (const sentence of rawText.split(/[.!\n]/)) {
    if (/\b(sans|évite|évitez|ne\s+veux\s+pas|jamais)\b/i.test(sentence) && sentence.trim().length > 0) {
      constraints.push(sentence.trim());
    }
  }

  const ctaMatch = rawText.match(/(?:cta|appel à l'action)\s*[:\-]?\s*([^.!\n]+)/i);

  return BriefSpecSchema.parse({
    objective: rawText.slice(0, 200).trim() || "Vidéo courte pour réseaux sociaux",
    audience: /entrepreneur/i.test(rawText)
      ? "entrepreneurs"
      : /coach/i.test(rawText)
        ? "audience de coaching"
        : "audience générale réseaux sociaux",
    platform,
    targetDurationSec,
    tone: dynamism > 0.6 ? "dynamique" : dynamism < 0.4 ? "premium et posé" : "neutre",
    style: dynamicWords.test(rawText) ? "dynamique" : calmWords.test(rawText) ? "premium" : "standard",
    cta: ctaMatch?.[1]?.trim(),
    dynamism,
    constraints,
  });
}
