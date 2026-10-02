import { newId, microToUsd, type CostAgent, type CostLedgerEntry } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { ProviderCallResult } from "@video-editor/model-router";

/**
 * Point d'entrée unique pour enregistrer un appel de fournisseur dans le
 * cost_ledger. C'est le seul endroit qui transforme un ProviderCallResult
 * (technique, sans contexte métier) en CostLedgerEntry (avec projectId,
 * agent, stage) — §10 du brief : chaque appel externe doit être
 * traçable, sans exception, aucun agent ne doit écrire dans la table
 * directement.
 */
export function recordProviderCall(
  db: Db,
  args: { projectId: string; agent: CostAgent; stage: string; result: ProviderCallResult<unknown> }
): void {
  const entry: CostLedgerEntry = {
    id: newId("cost"),
    projectId: args.projectId,
    agent: args.agent,
    provider: args.result.provider,
    model: args.result.model,
    stage: args.stage,
    callType: inferCallType(args.agent),
    inputUnits: args.result.inputUnits,
    inputUnitType: args.result.inputUnitType,
    outputUnits: args.result.outputUnits,
    outputUnitType: args.result.outputUnitType,
    durationMs: args.result.durationMs,
    costMicroUsd: args.result.costMicroUsd,
    isStub: args.result.isStub,
    createdAt: new Date().toISOString(),
  };
  db.recordCost(entry);
}

function inferCallType(agent: CostAgent): CostLedgerEntry["callType"] {
  switch (agent) {
    case "video_analyzer":
    case "style_extractor":
      return "vision";
    case "render_engine":
      return "render";
    default:
      return "llm";
  }
}

export interface CostSummary {
  totalMicroUsd: number;
  totalUsd: number;
  isFullyStub: boolean;
  byAgent: Record<string, number>;
  byProvider: Record<string, number>;
  entryCount: number;
}

/** §10 du brief : "je veux pouvoir savoir exactement combien nous coûte une vidéo". */
export function projectCostSummary(db: Db, projectId: string): CostSummary {
  const entries = db.listCostByProject(projectId);
  const byAgent: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let totalMicroUsd = 0;
  let isFullyStub = entries.length > 0;
  for (const e of entries) {
    totalMicroUsd += e.costMicroUsd;
    byAgent[e.agent] = (byAgent[e.agent] ?? 0) + e.costMicroUsd;
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + e.costMicroUsd;
    if (!e.isStub) isFullyStub = false;
  }
  return {
    totalMicroUsd,
    totalUsd: microToUsd(totalMicroUsd),
    isFullyStub,
    byAgent,
    byProvider,
    entryCount: entries.length,
  };
}

/** Objectifs de conception du §10 du brief, pour comparer un coût mesuré à la cible. */
export const COST_TARGETS_USD = {
  mvp: 2,
  optimized: 1,
  longTerm: 0.5,
} as const;
