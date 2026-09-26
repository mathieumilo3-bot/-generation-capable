import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeComparison, type CmpLine, type CmpOffer, type CmpSupplier } from "./compute";

/** Charge un dossier (avec le client fourni, donc sous RLS) et calcule son comparatif. */
export async function loadComparison(supabase: SupabaseClient<Database>, projectId: string) {
  const [{ data: lines }, { data: consultations }, { data: offers }] = await Promise.all([
    supabase.from("project_lines").select("id, position, lot, code, designation, quantity, unit").eq("project_id", projectId).order("position"),
    supabase
      .from("consultations")
      .select("id, status, supplier_id, suppliers(company_name), consultation_lines(project_line_id)")
      .eq("project_id", projectId)
      .not("status", "in", "(a_envoyer,annulee)")
      .order("created_at"),
    supabase.from("offers").select("*, offer_lines(*)").eq("project_id", projectId).eq("is_current", true),
  ]);

  const offerByConsultation = new Map((offers ?? []).map((o) => [o.consultation_id, o]));
  const suppliers: CmpSupplier[] = (consultations ?? []).map((c) => {
    const o = offerByConsultation.get(c.id);
    const offer: CmpOffer | null = o
      ? {
          id: o.id,
          quoteReference: o.quote_reference,
          totalHt: o.total_ht,
          deliveryCost: o.delivery_cost,
          deliveryIncluded: o.delivery_included as CmpOffer["deliveryIncluded"],
          commissioningIncluded: o.commissioning_included as CmpOffer["commissioningIncluded"],
          validityDate: o.validity_date,
          deliveryDelay: o.delivery_delay,
          paymentTerms: o.payment_terms,
          exclusions: o.exclusions,
          reservations: o.reservations,
          confidence: o.confidence,
          lines: [...o.offer_lines]
            .sort((a, b) => a.position - b.position)
            .map((l) => ({
              id: l.id,
              projectLineId: l.project_line_id,
              matchStatus: l.match_status as CmpOffer["lines"][number]["matchStatus"],
              supplierReference: l.supplier_reference,
              supplierDesignation: l.supplier_designation,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unit_price,
              totalPrice: l.total_price,
              discount: l.discount,
              isAlternative: l.is_alternative,
              alternativeNote: l.alternative_note,
              isFee: l.is_fee,
              confidence: l.confidence,
              duplicateOf: ((l.source as { duplicate_of?: string | null } | null)?.duplicate_of ?? null) as string | null,
            })),
        }
      : null;
    return {
      consultationId: c.id,
      supplierId: c.supplier_id,
      name: c.suppliers?.company_name ?? "Fournisseur",
      status: c.status,
      requestedLineIds: c.consultation_lines.map((l) => l.project_line_id),
      offer,
    };
  });
  const cmpLines: CmpLine[] = (lines ?? []).map((l) => ({ ...l }));
  return computeComparison(cmpLines, suppliers);
}
