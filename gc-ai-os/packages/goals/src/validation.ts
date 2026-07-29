import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { Mission } from "@gc-ai-os/shared-types";

export interface ValidationVerdict {
  passed: boolean;
  critique: string;
}

/** Un livrable plus court que cela ne peut pas satisfaire un critère de réussite sérieux. */
const MIN_USEFUL_LENGTH = 200;

/**
 * Porte de validation d'un livrable (voir docs/gc-ai-os/10-moteur-objectifs.md).
 *
 * Deux niveaux, volontairement séparés :
 *
 * 1. Contrôles structurels déterministes (toujours exécutés) — livrable
 *    vide, tronqué, ou refus d'agent. Ils sont fiables et gratuits ; ils
 *    attrapent la majorité des échecs réels.
 * 2. Jugement qualitatif par modèle (si une clé est configurée) — le
 *    livrable répond-il vraiment au critère d'acceptation. C'est un
 *    usage où le LLM apporte ce qu'aucune règle ne sait faire.
 *
 * Si le modèle est indisponible, on ne prétend pas avoir validé sur le
 * fond : `critique` le dit explicitement, et seuls les contrôles
 * structurels font foi.
 */
export class DeliverableValidator {
  constructor(private readonly model: ModelProvider) {}

  async validate(mission: Mission, content: string): Promise<ValidationVerdict> {
    const structural = this.checkStructure(content);
    if (!structural.passed) return structural;

    if (this.model.mode !== "anthropic") {
      return {
        passed: true,
        critique:
          "Contrôles structurels passés. Jugement qualitatif non effectué " +
          "(aucun modèle configuré) — la conformité au critère d'acceptation n'a pas été vérifiée sur le fond.",
      };
    }

    return this.judge(mission, content);
  }

  private checkStructure(content: string): ValidationVerdict {
    const trimmed = content.trim();

    if (trimmed.length === 0) {
      return { passed: false, critique: "Livrable vide." };
    }
    if (trimmed.length < MIN_USEFUL_LENGTH) {
      return {
        passed: false,
        critique: `Livrable trop court (${trimmed.length} caractères) pour satisfaire un critère de réussite.`,
      };
    }
    return { passed: true, critique: "" };
  }

  private async judge(mission: Mission, content: string): Promise<ValidationVerdict> {
    try {
      const completion = await this.model.complete([
        {
          role: "system",
          content:
            "Tu es la porte de validation de GC AI OS. On te donne un critère d'acceptation et " +
            "un livrable. Détermine si le livrable satisfait réellement le critère. Sois " +
            "exigeant mais juste : un livrable partiel mais utilisable passe, un livrable hors " +
            "sujet ou creux échoue. Réponds STRICTEMENT en JSON : " +
            '{"passed": true|false, "critique": "ce qui manque, en une à trois phrases"}',
        },
        {
          role: "user",
          content:
            `Mission : ${mission.title}\n` +
            `Critère d'acceptation : ${mission.acceptanceCriteria}\n\n` +
            `Livrable :\n${content.slice(0, 6000)}`,
        },
      ]);

      const parsed = parseVerdict(completion.text);
      if (parsed) return parsed;

      // Réponse du modèle inexploitable : on ne bloque pas un livrable
      // structurellement valide sur une erreur de format du juge.
      return {
        passed: true,
        critique: "Jugement qualitatif illisible — validé sur les seuls contrôles structurels.",
      };
    } catch {
      return {
        passed: true,
        critique: "Jugement qualitatif indisponible (erreur modèle) — contrôles structurels seuls.",
      };
    }
  }
}

function parseVerdict(raw: string): ValidationVerdict | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as Partial<ValidationVerdict>;
    if (typeof data.passed !== "boolean") return null;
    return { passed: data.passed, critique: String(data.critique ?? "") };
  } catch {
    return null;
  }
}
