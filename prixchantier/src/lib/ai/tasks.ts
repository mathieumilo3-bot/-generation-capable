import { z } from "zod";
import { getLlm, type LlmPart } from "./llm";
import { CATEGORIES } from "@/lib/labels";

/**
 * Tâches IA à sortie strictement structurée.
 * Règle commune à tous les prompts : recopier, ne jamais inventer ; laisser
 * null ce qui n'est pas écrit ; signaler l'incertitude via `confidence`.
 */

export { CATEGORIES };

const confidence = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// 1. Classement des lignes d'un dossier
// ---------------------------------------------------------------------------

const classificationSchema = z.object({
  items: z.array(
    z.object({
      i: z.number().int(),
      category: z.enum(CATEGORIES),
      supplier_required: z.boolean(),
      subcontractor_required: z.boolean(),
      confidence,
    }),
  ),
});

export type LineClassification = z.infer<typeof classificationSchema>["items"][number];

export async function classifyLines(
  lines: { i: number; lot: string | null; code: string | null; designation: string; unit: string | null }[],
): Promise<Map<number, LineClassification>> {
  const out = new Map<number, LineClassification>();
  const BATCH = 80;
  for (let start = 0; start < lines.length; start += BATCH) {
    const batch = lines.slice(start, start + BATCH);
    const res = await getLlm().structured({
      name: "classement_lignes",
      schema: classificationSchema,
      system: [
        "Tu es chiffreur dans une entreprise française du BTP (CVC, plomberie, électricité).",
        "Pour chaque ligne d'un DPGF, indique :",
        "- category : la famille d'achat la plus proche dans la liste imposée ;",
        "- supplier_required : true si la ligne comporte du matériel ou des équipements à acheter auprès d'un négoce ou d'un fabricant (prix fournisseur nécessaire) ; false pour une prestation pure (main d'œuvre, essais, DOE, études, formation) ;",
        "- subcontractor_required : true si la prestation est habituellement sous-traitée (calorifuge, carottage, désamiantage, traitement d'eau, mise en service constructeur, certification, équilibrage…) ;",
        "- confidence : ta certitude entre 0 et 1. Si la désignation est vague, mets moins de 0.6.",
        "Réponds pour CHAQUE ligne reçue, avec le même identifiant i. N'invente aucune ligne.",
      ].join("\n"),
      content: JSON.stringify(batch),
    });
    for (const item of res.items) {
      if (batch.some((l) => l.i === item.i)) out.set(item.i, item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Extraction des lignes d'un DPGF non tabulaire (PDF)
// ---------------------------------------------------------------------------

const pdfLinesSchema = z.object({
  lines: z.array(
    z.object({
      page: z.number().int().nullable(),
      lot: z.string().nullable(),
      code: z.string().nullable(),
      designation: z.string(),
      description: z.string().nullable(),
      quantity_text: z.string().nullable(),
      unit_text: z.string().nullable(),
      confidence,
    }),
  ),
});

export type ExtractedPdfLine = z.infer<typeof pdfLinesSchema>["lines"][number];

const PDF_LINES_SYSTEM = [
  "Tu extrais les postes chiffrables d'un DPGF / DQE / BPU du BTP français.",
  "Règles impératives :",
  "- recopie référence, désignation, quantité et unité EXACTEMENT comme écrites (quantity_text tel qu'imprimé, ex. \"1 250,5\") ;",
  "- une ligne = un poste avec quantité ou unité ; les titres de chapitres vont dans `lot` des lignes qui suivent ;",
  "- ignore les sous-totaux, totaux, TVA, récapitulatifs ;",
  "- n'invente jamais une quantité ou une unité absente : mets null ;",
  "- page = numéro de page où figure la ligne ;",
  "- confidence < 0.6 si la ligne est partiellement illisible ou ambiguë.",
].join("\n");

export async function extractDpgfLinesFromText(pages: { page: number; text: string }[]): Promise<ExtractedPdfLine[]> {
  const content = pages.map((p) => `=== Page ${p.page} ===\n${p.text}`).join("\n\n");
  const res = await getLlm().structured({ name: "lignes_dpgf", schema: pdfLinesSchema, system: PDF_LINES_SYSTEM, content });
  return res.lines;
}

export async function extractDpgfLinesFromScan(file: { filename: string; data: Buffer; firstPage: number }) {
  const res = await getLlm().structured({
    name: "lignes_dpgf",
    schema: pdfLinesSchema,
    system: `${PDF_LINES_SYSTEM}\nLe document est un scan : lis-le visuellement. La première page de ce fichier est la page ${file.firstPage} du document.`,
    content: [
      { type: "text", text: "Extrais les postes de ce DPGF scanné." },
      { type: "pdf", filename: file.filename, data: file.data },
    ],
  });
  return res.lines;
}

// ---------------------------------------------------------------------------
// 3. Extraction d'une offre fournisseur
// ---------------------------------------------------------------------------

const sourced = <T extends z.ZodType>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence,
    source_excerpt: z.string().nullable(),
    page: z.number().int().nullable(),
  });

const offerSchema = z.object({
  classification: z.enum(["offer", "partial", "refusal", "other"]),
  classification_reason: z.string(),
  quote_reference: sourced(z.string()),
  quote_date: sourced(z.string().describe("AAAA-MM-JJ")),
  validity_date: sourced(z.string().describe("AAAA-MM-JJ, calculée seulement si une date d'émission ET une durée sont écrites")),
  validity_text: z.string().nullable(),
  delivery_delay: sourced(z.string()),
  payment_terms: sourced(z.string()),
  delivery_cost: sourced(z.number()),
  delivery_included: z.enum(["yes", "no", "unknown"]),
  commissioning_included: z.enum(["yes", "no", "unknown", "not_applicable"]),
  total_ht: sourced(z.number()),
  currency: z.string(),
  exclusions: z.array(z.string()),
  reservations: z.array(z.string()),
  comments: z.string().nullable(),
  lines: z.array(
    z.object({
      supplier_reference: z.string().nullable(),
      supplier_designation: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      unit_price: z.number().nullable(),
      total_price: z.number().nullable(),
      discount: z.string().nullable(),
      availability: z.string().nullable(),
      delivery_delay: z.string().nullable(),
      is_alternative: z.boolean(),
      alternative_note: z.string().nullable(),
      is_fee: z.boolean(),
      matched_request: z.string().nullable(),
      match_confidence: confidence,
      confidence,
      page: z.number().int().nullable(),
    }),
  ),
});

export type ExtractedOffer = z.infer<typeof offerSchema>;

export type RequestedLine = { key: string; code: string | null; designation: string; quantity: number | null; unit: string | null };

const OFFER_SYSTEM = [
  "Tu analyses la réponse d'un fournisseur à une demande de prix du BTP français.",
  "Tu reçois : les lignes demandées (clé R1, R2…), le texte de l'e-mail et le contenu des pièces jointes.",
  "",
  "classification :",
  "- offer : une offre chiffrée couvrant la demande ;",
  "- partial : une offre chiffrée ne couvrant qu'une partie, ou annonçant un complément ;",
  "- refusal : le fournisseur décline (ne fait pas, ne peut pas chiffrer) ;",
  "- other : accusé de réception, question, message d'absence, sans prix.",
  "",
  "Règles impératives :",
  "- recopie les prix tels qu'écrits, en nombres (\"1 234,50\" → 1234.5). Ne calcule JAMAIS un prix absent : null ;",
  "- unit_price = prix unitaire NET HT après remise s'il est écrit ; discount = remise telle qu'écrite (ex. \"35%\") ;",
  "- chaque ligne chiffrée du devis donne une ligne, y compris frais (port, emballage, livraison, mise en service) avec is_fee = true ;",
  "- is_alternative = true si le produit diffère de celui demandé (variante, équivalent, autre modèle, autre dimension) ;",
  "- matched_request = clé de la ligne demandée correspondante UNIQUEMENT si tu es sûr ; sinon null. Ne force jamais une correspondance ;",
  "- match_confidence : 0.9+ si référence/désignation/quantité concordent, 0.5-0.8 si probable, <0.5 sinon ;",
  "- delivery_included : \"no\" si livraison/port facturé en sus ou non inclus ; \"yes\" si franco/inclus explicitement ; sinon \"unknown\" ;",
  "- commissioning_included : \"no\" si la mise en service est exclue ou non comprise ; \"not_applicable\" si sans objet ;",
  "- exclusions / reservations : recopie les phrases d'exclusion et de réserve ;",
  "- pour chaque champ d'en-tête : value, confidence, source_excerpt (extrait exact du document), page ;",
  "- dates au format AAAA-MM-JJ ; si l'information est absente, value = null et confidence = 0.",
].join("\n");

export async function extractOffer(input: {
  requested: RequestedLine[];
  emailText: string | null;
  documents: ({ name: string; text: string } | { name: string; pdf: Buffer })[];
}): Promise<ExtractedOffer> {
  const requested = input.requested
    .map((r) => `${r.key}: ${r.code ? `[${r.code}] ` : ""}${r.designation} — ${r.quantity ?? "?"} ${r.unit ?? ""}`)
    .join("\n");
  const parts: LlmPart[] = [
    { type: "text", text: `LIGNES DEMANDÉES :\n${requested}` },
    { type: "text", text: `E-MAIL DU FOURNISSEUR :\n${input.emailText?.trim() || "(vide)"}` },
  ];
  for (const doc of input.documents) {
    if ("text" in doc) parts.push({ type: "text", text: `PIÈCE JOINTE « ${doc.name} » :\n${doc.text}` });
    else {
      parts.push({ type: "text", text: `PIÈCE JOINTE « ${doc.name} » (document scanné, joint ci-après) :` });
      parts.push({ type: "pdf", filename: doc.name, data: doc.pdf });
    }
  }
  return getLlm().structured({ name: "offre_fournisseur", schema: offerSchema, system: OFFER_SYSTEM, content: parts });
}
