import { normalizeCode, tokens } from "@/lib/parsing/normalize";

/**
 * Rapprochement des lignes d'un devis fournisseur avec les lignes demandées.
 *
 * Principe : on ne force jamais une correspondance. Un score combine
 * référence, similarité de désignation (dimensions pondérées), quantité et,
 * s'il existe, l'avis de l'IA. Au-dessous du seuil de fiabilité la ligne
 * reste « à vérifier » ou « non rattachée ».
 */

export type RequestedRef = {
  id: string;
  code: string | null;
  designation: string;
  quantity: number | null;
  unit: string | null;
};

export type OfferLineRef = {
  supplier_reference: string | null;
  supplier_designation: string;
  quantity: number | null;
  is_fee: boolean;
  /** Ligne déjà identifiée sans ambiguïté (fichier de consultation rempli). */
  exactProjectLineId?: string | null;
  aiMatchId?: string | null;
  aiMatchConfidence?: number | null;
};

export type MatchStatus = "matched" | "to_verify" | "unmatched";

export type MatchResult = {
  projectLineId: string | null;
  status: MatchStatus;
  score: number;
  method: "template" | "code" | "similarity" | "ai";
  duplicateOf?: string;
};

export const MATCH_THRESHOLD = 0.8;
export const VERIFY_THRESHOLD = 0.5;

const hasDigit = (t: string) => /\d/.test(t);

export function designationSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  const weight = (t: string) => (hasDigit(t) ? 2 : 1);
  let inter = 0;
  let wa = 0;
  let wb = 0;
  for (const t of ta) {
    wa += weight(t);
    if (tb.has(t)) inter += weight(t);
  }
  for (const t of tb) wb += weight(t);
  let score = (2 * inter) / (wa + wb);
  // Dimensions contradictoires (DN20 vs DN25) : forte pénalité.
  const na = [...ta].filter(hasDigit);
  const nb = [...tb].filter(hasDigit);
  if (na.length && nb.length && !na.some((t) => tb.has(t))) score *= 0.5;
  return score;
}

function pairScore(o: OfferLineRef, r: RequestedRef): { score: number; method: MatchResult["method"] } {
  const code = normalizeCode(r.code);
  if (code && code.length >= 3) {
    if (normalizeCode(o.supplier_reference) === code) return { score: 1, method: "code" };
  }
  let score = designationSimilarity(o.supplier_designation, r.designation);
  if (o.quantity !== null && r.quantity !== null && Math.abs(o.quantity - r.quantity) < 1e-6) score += 0.12;
  let method: MatchResult["method"] = "similarity";
  if (o.aiMatchId === r.id && o.aiMatchConfidence != null) {
    score += 0.3 * o.aiMatchConfidence;
    method = "ai";
  }
  return { score: Math.min(1, score), method };
}

export function matchOfferLines(requested: RequestedRef[], offerLines: OfferLineRef[]): MatchResult[] {
  const results: MatchResult[] = offerLines.map(() => ({
    projectLineId: null,
    status: "unmatched",
    score: 0,
    method: "similarity",
  }));
  const taken = new Set<string>();
  const requestedIds = new Set(requested.map((r) => r.id));

  // 1. Correspondances exactes (fichier de consultation rempli).
  offerLines.forEach((o, i) => {
    if (o.exactProjectLineId && requestedIds.has(o.exactProjectLineId) && !taken.has(o.exactProjectLineId)) {
      results[i] = { projectLineId: o.exactProjectLineId, status: "matched", score: 1, method: "template" };
      taken.add(o.exactProjectLineId);
    }
  });

  // 2. Meilleures paires, attribuées de façon gloutonne par score décroissant.
  const pairs: { i: number; id: string; score: number; method: MatchResult["method"] }[] = [];
  offerLines.forEach((o, i) => {
    if (results[i].method === "template") return;
    for (const r of requested) {
      const { score, method } = pairScore(o, r);
      if (score >= 0.3) pairs.push({ i, id: r.id, score, method });
    }
  });
  pairs.sort((a, b) => b.score - a.score);
  const assigned = new Set<number>();
  for (const p of pairs) {
    if (assigned.has(p.i) || taken.has(p.id)) continue;
    const o = offerLines[p.i];
    // Un frais (port, emballage) n'est rattaché que sur une correspondance nette.
    if (o.is_fee && p.score < MATCH_THRESHOLD) continue;
    if (p.score < VERIFY_THRESHOLD) continue;
    results[p.i] = {
      projectLineId: p.id,
      status: p.score >= MATCH_THRESHOLD ? "matched" : "to_verify",
      score: Math.round(p.score * 100) / 100,
      method: p.method,
    };
    assigned.add(p.i);
    taken.add(p.id);
  }

  // 3. Doublons possibles : ligne non rattachée très proche d'une ligne déjà prise.
  offerLines.forEach((o, i) => {
    if (results[i].projectLineId || o.is_fee) return;
    const best = pairs.find((p) => p.i === i && p.score >= MATCH_THRESHOLD && taken.has(p.id));
    if (best) results[i] = { ...results[i], duplicateOf: best.id, score: Math.round(best.score * 100) / 100 };
  });
  return results;
}
