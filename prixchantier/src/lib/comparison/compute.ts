import { normalizeUnit, round2 } from "@/lib/parsing/normalize";
import { euros, plural } from "@/lib/format";

/**
 * Calcul du comparatif — fonction pure, sans accès base.
 * Détecte les trous (lignes absentes, quantités/unités différentes,
 * variantes, frais, livraison et mise en service exclues, validité proche,
 * ambiguïtés, doublons) et produit des phrases d'analyse qui n'affirment
 * jamais qu'un fournisseur est « le meilleur » quand les périmètres diffèrent.
 */

export type CmpLine = {
  id: string;
  position: number;
  lot: string | null;
  code: string | null;
  designation: string;
  quantity: number | null;
  unit: string | null;
};

export type CmpOfferLine = {
  id: string;
  projectLineId: string | null;
  matchStatus: "matched" | "to_verify" | "unmatched" | "user_confirmed" | "user_rejected";
  supplierReference: string | null;
  supplierDesignation: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  discount: string | null;
  isAlternative: boolean;
  alternativeNote: string | null;
  isFee: boolean;
  confidence: number | null;
  duplicateOf: string | null;
};

export type CmpOffer = {
  id: string;
  quoteReference: string | null;
  totalHt: number | null;
  deliveryCost: number | null;
  deliveryIncluded: "yes" | "no" | "unknown";
  commissioningIncluded: "yes" | "no" | "unknown" | "not_applicable";
  validityDate: string | null;
  deliveryDelay: string | null;
  paymentTerms: string | null;
  exclusions: string[];
  reservations: string[];
  confidence: number | null;
  lines: CmpOfferLine[];
};

export type CmpSupplier = {
  consultationId: string;
  supplierId: string;
  name: string;
  status: string;
  requestedLineIds: string[];
  offer: CmpOffer | null;
};

export type CellAlert = "qty_diff" | "unit_diff" | "alternative" | "low_confidence" | "computed_total";

export type Cell =
  | { kind: "not_requested" }
  | { kind: "awaiting" }
  | { kind: "refused" }
  | { kind: "missing" }
  | { kind: "unpriced"; offerLineId: string; verify: boolean; note: string | null }
  | {
      kind: "priced";
      offerLineId: string;
      unitPrice: number | null;
      total: number;
      quantity: number | null;
      unit: string | null;
      verify: boolean;
      alerts: CellAlert[];
      isBest: boolean;
      supplierDesignation: string | null;
      alternativeNote: string | null;
    };

export type SupplierAlert = { level: "danger" | "warning" | "info"; code: string; message: string };

export type SupplierSummary = {
  consultationId: string;
  supplierId: string;
  name: string;
  status: string;
  hasOffer: boolean;
  total: number | null;
  totalSource: "stated" | "computed" | null;
  linesTotal: number;
  feesTotal: number;
  requestedCount: number;
  pricedCount: number;
  missingCount: number;
  toVerifyCount: number;
  alternativeCount: number;
  differenceCount: number;
  coverage: number;
  offer: CmpOffer | null;
  alerts: SupplierAlert[];
};

export type Comparison = {
  lines: CmpLine[];
  suppliers: SupplierSummary[];
  cells: Record<string, Record<string, Cell>>;
  insights: string[];
  bestPriceTotal: number | null;
  filters: { missing: string[]; differences: string[]; toVerify: string[]; comparable: string[] };
};

const ACTIVE = new Set(["matched", "to_verify", "user_confirmed"]);
const REFUSED = new Set(["refus"]);

function daysBetween(fromIso: string, to: Date) {
  const d = new Date(`${fromIso}T23:59:59Z`);
  return Math.floor((d.getTime() - to.getTime()) / 86_400_000);
}

export function computeComparison(lines: CmpLine[], suppliers: CmpSupplier[], today = new Date()): Comparison {
  const requestedAnywhere = new Set(suppliers.flatMap((s) => s.requestedLineIds));
  const rows = lines.filter((l) => requestedAnywhere.has(l.id)).sort((a, b) => a.position - b.position);
  const cells: Comparison["cells"] = {};
  const summaries: SupplierSummary[] = [];

  for (const line of rows) cells[line.id] = {};

  for (const s of suppliers) {
    const requested = new Set(s.requestedLineIds);
    const byLine = new Map<string, CmpOfferLine>();
    for (const ol of s.offer?.lines ?? []) {
      if (ol.projectLineId && ACTIVE.has(ol.matchStatus) && !byLine.has(ol.projectLineId)) byLine.set(ol.projectLineId, ol);
    }
    const summary: SupplierSummary = {
      consultationId: s.consultationId,
      supplierId: s.supplierId,
      name: s.name,
      status: s.status,
      hasOffer: Boolean(s.offer),
      total: null,
      totalSource: null,
      linesTotal: 0,
      feesTotal: 0,
      requestedCount: requested.size,
      pricedCount: 0,
      missingCount: 0,
      toVerifyCount: 0,
      alternativeCount: 0,
      differenceCount: 0,
      coverage: 0,
      offer: s.offer,
      alerts: [],
    };

    for (const line of rows) {
      let cell: Cell;
      if (!requested.has(line.id)) cell = { kind: "not_requested" };
      else if (!s.offer) cell = REFUSED.has(s.status) ? { kind: "refused" } : { kind: "awaiting" };
      else {
        const ol = byLine.get(line.id);
        const verify = ol?.matchStatus === "to_verify";
        if (!ol) {
          cell = { kind: "missing" };
          summary.missingCount++;
        } else if (ol.unitPrice === null && ol.totalPrice === null) {
          cell = { kind: "unpriced", offerLineId: ol.id, verify, note: ol.alternativeNote };
          summary.missingCount++;
        } else {
          const alerts: CellAlert[] = [];
          const qty = ol.quantity ?? line.quantity;
          let total = ol.totalPrice;
          if (total === null) {
            total = round2((ol.unitPrice ?? 0) * (qty ?? 0));
            alerts.push("computed_total");
          }
          if (ol.quantity !== null && line.quantity !== null && Math.abs(ol.quantity - line.quantity) > Math.max(1e-6, line.quantity * 0.005)) {
            alerts.push("qty_diff");
          }
          const ou = normalizeUnit(ol.unit);
          const lu = normalizeUnit(line.unit);
          if (ou && lu && ou !== lu) alerts.push("unit_diff");
          if (ol.isAlternative) alerts.push("alternative");
          if (ol.confidence !== null && ol.confidence < 0.6) alerts.push("low_confidence");
          cell = {
            kind: "priced",
            offerLineId: ol.id,
            unitPrice: ol.unitPrice,
            total,
            quantity: ol.quantity,
            unit: ol.unit,
            verify,
            alerts,
            isBest: false,
            supplierDesignation: ol.supplierDesignation,
            alternativeNote: ol.alternativeNote,
          };
          summary.pricedCount++;
          summary.linesTotal += total;
          if (verify) summary.toVerifyCount++;
          if (ol.isAlternative) summary.alternativeCount++;
          if (alerts.some((a) => a === "qty_diff" || a === "unit_diff" || a === "alternative")) summary.differenceCount++;
        }
      }
      cells[line.id][s.consultationId] = cell;
    }

    if (s.offer) finalizeSupplier(summary, s.offer, today);
    summaries.push(summary);
  }

  // Meilleur prix ligne à ligne (prix unitaire, puis total), toutes offres confondues.
  let bestPriceTotal: number | null = null;
  const comparable: string[] = [];
  for (const line of rows) {
    const priced = Object.entries(cells[line.id]).filter(([, c]) => c.kind === "priced") as [string, Extract<Cell, { kind: "priced" }>][];
    if (!priced.length) continue;
    if (priced.length >= 2) comparable.push(line.id);
    const key = (c: Extract<Cell, { kind: "priced" }>) => c.total;
    const min = Math.min(...priced.map(([, c]) => key(c)));
    for (const [, c] of priced) if (key(c) === min) c.isBest = true;
    bestPriceTotal = round2((bestPriceTotal ?? 0) + min);
  }

  const filters = {
    missing: rows.filter((l) => Object.values(cells[l.id]).some((c) => c.kind === "missing" || c.kind === "unpriced")).map((l) => l.id),
    differences: rows
      .filter((l) =>
        Object.values(cells[l.id]).some(
          (c) => c.kind === "priced" && c.alerts.some((a) => a === "qty_diff" || a === "unit_diff" || a === "alternative"),
        ),
      )
      .map((l) => l.id),
    toVerify: rows
      .filter((l) => Object.values(cells[l.id]).some((c) => (c.kind === "priced" || c.kind === "unpriced") && c.verify))
      .map((l) => l.id),
    comparable,
  };

  return {
    lines: rows,
    suppliers: summaries,
    cells,
    insights: buildInsights(summaries, rows, cells),
    bestPriceTotal,
    filters,
  };
}

function finalizeSupplier(summary: SupplierSummary, offer: CmpOffer, today: Date) {
  const alerts = summary.alerts;
  const fees = offer.lines.filter((l) => l.isFee && !(l.projectLineId && ACTIVE.has(l.matchStatus)));
  summary.feesTotal = round2(fees.reduce((n, l) => n + (l.totalPrice ?? (l.unitPrice ?? 0) * (l.quantity ?? 1)), 0));
  const deliveryCost = offer.deliveryCost && !fees.length ? offer.deliveryCost : 0;
  summary.linesTotal = round2(summary.linesTotal);
  const computed = round2(summary.linesTotal + summary.feesTotal + deliveryCost);

  if (offer.totalHt !== null) {
    summary.total = offer.totalHt;
    summary.totalSource = "stated";
    const unmatchedPriced = offer.lines.filter(
      (l) => !l.isFee && !(l.projectLineId && ACTIVE.has(l.matchStatus)) && (l.totalPrice ?? l.unitPrice) !== null,
    );
    if (Math.abs(offer.totalHt - computed) > Math.max(5, offer.totalHt * 0.01) && !unmatchedPriced.length) {
      alerts.push({
        level: "warning",
        code: "total_mismatch",
        message: `Total annoncé (${euros(offer.totalHt)}) différent de la somme des lignes (${euros(computed)}).`,
      });
    }
  } else {
    summary.total = computed;
    summary.totalSource = "computed";
  }
  summary.coverage = summary.requestedCount ? summary.pricedCount / summary.requestedCount : 0;

  if (summary.missingCount) {
    alerts.push({ level: "danger", code: "missing", message: `${plural(summary.missingCount, "ligne demandée absente", "lignes demandées absentes")} du devis.` });
  }
  const unmatched = offer.lines.filter((l) => !l.isFee && !l.projectLineId && l.matchStatus !== "user_rejected");
  if (unmatched.length) {
    alerts.push({ level: "warning", code: "unmatched", message: `${plural(unmatched.length, "ligne du devis non rattachée", "lignes du devis non rattachées")} à la demande.` });
  }
  if (summary.toVerifyCount) {
    alerts.push({ level: "warning", code: "to_verify", message: `${plural(summary.toVerifyCount, "correspondance à vérifier", "correspondances à vérifier")}.` });
  }
  if (summary.alternativeCount) {
    alerts.push({ level: "warning", code: "alternative", message: `${plural(summary.alternativeCount, "produit alternatif / variante proposé", "produits alternatifs / variantes proposés")}.` });
  }
  const qtyDiff = summary.differenceCount - summary.alternativeCount;
  if (qtyDiff > 0) {
    alerts.push({ level: "warning", code: "differences", message: `${plural(qtyDiff, "ligne avec quantité ou unité différente", "lignes avec quantité ou unité différente")}.` });
  }
  if (summary.feesTotal > 0 || deliveryCost > 0) {
    alerts.push({ level: "info", code: "fees", message: `Frais supplémentaires : ${euros(summary.feesTotal + deliveryCost)} (port, emballage…).` });
  }
  if (offer.deliveryIncluded === "no") alerts.push({ level: "warning", code: "delivery", message: "Livraison non incluse." });
  if (offer.commissioningIncluded === "no") alerts.push({ level: "warning", code: "commissioning", message: "Mise en service non incluse." });
  if (offer.validityDate) {
    const days = daysBetween(offer.validityDate, today);
    if (days < 0) alerts.push({ level: "danger", code: "expired", message: "Offre expirée." });
    else if (days <= 7) alerts.push({ level: "warning", code: "expiring", message: `Offre valable encore ${plural(days, "jour", "jours")}.` });
  }
  const duplicates = offer.lines.filter((l) => l.duplicateOf);
  if (duplicates.length) {
    alerts.push({ level: "warning", code: "duplicates", message: `${plural(duplicates.length, "doublon possible", "doublons possibles")} dans le devis.` });
  }
  const lowConfidence = offer.lines.filter((l) => l.confidence !== null && l.confidence < 0.6).length;
  if (lowConfidence || (offer.confidence !== null && offer.confidence < 0.6)) {
    alerts.push({ level: "warning", code: "ambiguous", message: "Informations ambiguës : certaines valeurs sont à vérifier sur le document." });
  }
}

function caveats(s: SupplierSummary): string[] {
  const out: string[] = [];
  if (s.missingCount) out.push(`${plural(s.missingCount, "ligne est absente", "lignes sont absentes")}`);
  if (s.offer?.commissioningIncluded === "no") out.push("la mise en service semble exclue");
  if (s.offer?.deliveryIncluded === "no") out.push("la livraison n'est pas incluse");
  if (s.alternativeCount) out.push(`${plural(s.alternativeCount, "variante est proposée", "variantes sont proposées")}`);
  if (s.toVerifyCount) out.push(`${plural(s.toVerifyCount, "correspondance reste à vérifier", "correspondances restent à vérifier")}`);
  return out;
}

function joinFr(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

function buildInsights(summaries: SupplierSummary[], rows: CmpLine[], cells: Comparison["cells"]): string[] {
  const priced = summaries.filter((s) => s.hasOffer && s.total !== null && s.pricedCount > 0).sort((a, b) => a.total! - b.total!);
  const insights: string[] = [];
  if (priced.length < 2) {
    if (priced.length === 1) {
      const s = priced[0];
      const c = caveats(s);
      insights.push(`Une seule offre exploitable pour l'instant : ${s.name} (${euros(s.total)})${c.length ? `, mais ${joinFr(c)}` : ""}.`);
    }
    return insights;
  }
  const [first, second] = priced;
  const diff = second.total! - first.total!;
  const c = caveats(first);
  if (diff < 1) {
    insights.push(`${first.name} et ${second.name} sont au même prix (${euros(first.total)}).`);
  } else if (c.length) {
    insights.push(`${first.name} est actuellement ${euros(diff)} moins cher que ${second.name}, mais ${joinFr(c)}.`);
  } else {
    const secondCaveats = caveats(second);
    insights.push(
      `${first.name} est actuellement ${euros(diff)} moins cher que ${second.name}, sur un périmètre complet.` +
        (secondCaveats.length ? ` Chez ${second.name}, ${joinFr(secondCaveats)}.` : ""),
    );
  }

  // Comparaison à périmètre identique : lignes chiffrées par toutes les offres.
  const common = rows.filter((l) => priced.every((s) => cells[l.id][s.consultationId]?.kind === "priced"));
  if (common.length && common.length < rows.length) {
    const totals = priced
      .map((s) => ({
        s,
        t: common.reduce((n, l) => n + (cells[l.id][s.consultationId] as Extract<Cell, { kind: "priced" }>).total, 0),
      }))
      .sort((a, b) => a.t - b.t);
    insights.push(
      `À périmètre identique (${plural(common.length, "ligne chiffrée", "lignes chiffrées")} par tous), ${totals[0].s.name} est le moins cher : ${euros(totals[0].t)} contre ${euros(totals[1].t)} pour ${totals[1].s.name}.`,
    );
  } else if (!common.length) {
    insights.push("Aucune ligne n'est chiffrée par toutes les offres : les totaux ne portent pas sur le même périmètre.");
  }
  return insights;
}
