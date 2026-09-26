import type { ExtractedOffer } from "@/lib/ai/tasks";

/** Représentation intermédiaire d'une offre, quelle que soit sa source. */
export type DraftLine = {
  supplier_reference: string | null;
  supplier_designation: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  discount: string | null;
  availability: string | null;
  delivery_delay: string | null;
  is_alternative: boolean;
  alternative_note: string | null;
  is_fee: boolean;
  confidence: number;
  source: { file: string | null; sheet: string | null; row: number | null; page: number | null };
  exactProjectLineId: string | null;
  aiMatchKey: string | null;
  aiMatchConfidence: number | null;
};

export type OfferDraft = {
  sourceKind: "template" | "excel" | "pdf" | "pdf_ocr" | "csv" | "email_body" | "manual";
  classification: "offer" | "partial" | "refusal" | "other";
  header: {
    quote_reference: string | null;
    quote_date: string | null;
    validity_date: string | null;
    validity_text: string | null;
    delivery_delay: string | null;
    payment_terms: string | null;
    delivery_cost: number | null;
    delivery_included: "yes" | "no" | "unknown";
    commissioning_included: "yes" | "no" | "unknown" | "not_applicable";
    total_ht: number | null;
    currency: string;
    exclusions: string[];
    reservations: string[];
    comments: string | null;
  };
  confidence: number;
  extraction: Record<string, unknown>;
  lines: DraftLine[];
};

const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * Convertit la sortie IA en brouillon. Les champs dont la confiance est
 * trop faible sont conservés dans `extraction` (traçabilité) mais pas
 * promus en valeur : l'interface affiche alors « À vérifier ».
 */
export function draftFromExtraction(
  x: ExtractedOffer,
  sourceKind: OfferDraft["sourceKind"],
  sourceFileForPage: (page: number | null) => string | null,
): OfferDraft {
  const keep = <T>(f: { value: T | null; confidence: number }, min = 0.5) => (f.confidence >= min ? f.value : null);
  const headerConfidences = [x.total_ht, x.quote_date, x.validity_date]
    .filter((f) => f.value !== null)
    .map((f) => f.confidence);
  const lineConfidences = x.lines.map((l) => l.confidence);
  const all = [...headerConfidences, ...lineConfidences];
  const confidence = all.length ? Math.min(...all, 1) : 0;
  return {
    sourceKind,
    classification: x.classification,
    header: {
      quote_reference: keep(x.quote_reference),
      quote_date: isoDate(keep(x.quote_date)),
      validity_date: isoDate(keep(x.validity_date, 0.6)),
      validity_text: x.validity_text,
      delivery_delay: keep(x.delivery_delay),
      payment_terms: keep(x.payment_terms),
      delivery_cost: keep(x.delivery_cost, 0.6),
      delivery_included: x.delivery_included,
      commissioning_included: x.commissioning_included,
      total_ht: keep(x.total_ht, 0.6),
      currency: x.currency || "EUR",
      exclusions: x.exclusions,
      reservations: x.reservations,
      comments: x.comments,
    },
    confidence: Math.round(confidence * 100) / 100,
    extraction: {
      method: "ai",
      classification_reason: x.classification_reason,
      fields: {
        quote_reference: x.quote_reference,
        quote_date: x.quote_date,
        validity_date: x.validity_date,
        delivery_delay: x.delivery_delay,
        payment_terms: x.payment_terms,
        delivery_cost: x.delivery_cost,
        total_ht: x.total_ht,
      },
    },
    lines: x.lines.map((l) => ({
      supplier_reference: l.supplier_reference,
      supplier_designation: l.supplier_designation,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: l.unit_price,
      total_price: l.total_price,
      discount: l.discount,
      availability: l.availability,
      delivery_delay: l.delivery_delay,
      is_alternative: l.is_alternative,
      alternative_note: l.alternative_note,
      is_fee: l.is_fee,
      confidence: l.confidence,
      source: { file: sourceFileForPage(l.page), sheet: null, row: null, page: l.page },
      exactProjectLineId: null,
      aiMatchKey: l.matched_request,
      aiMatchConfidence: l.match_confidence,
    })),
  };
}
