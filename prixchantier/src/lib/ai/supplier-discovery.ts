import "server-only";

import OpenAI, { APIError } from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { AiFailure, classifyOpenAiError } from "@/lib/ai/llm";

const SupplierCandidateSchema = z.object({
  company_name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  website: z.string().url(),
  source_url: z.string().url(),
  categories: z.array(z.string().min(1).max(100)).min(1).max(8),
  matched_codes: z.array(z.string().min(1).max(100)).min(1).max(30),
  reason: z.string().min(1).max(400),
});

const SupplierDiscoverySchema = z.object({
  suppliers: z.array(SupplierCandidateSchema).max(8),
});

export type SupplierCandidate = z.infer<typeof SupplierCandidateSchema>;

export async function discoverSuppliersFromWeb(input: {
  projectName: string;
  projectReference?: string | null;
  categories: string[];
  lines: Array<{ code: string | null; designation: string; quantity: number | null; unit: string | null; category: string | null }>;
  limit?: number;
}): Promise<SupplierCandidate[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiFailure("not_configured");

  const client = new OpenAI({ apiKey: key, timeout: 180_000, maxRetries: 1 });
  const limit = Math.max(1, Math.min(input.limit ?? 5, 8));

  const lineSummary = input.lines
    .slice(0, 30)
    .map((l) => `- ${l.code ?? ""} | ${l.designation} | ${l.quantity ?? ""} ${l.unit ?? ""} | famille: ${l.category ?? "Divers"}`)
    .join("\n");

  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_WEB_MODEL || "gpt-5.5",
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      instructions:
        "Tu es un acheteur BTP français. Recherche sur Internet des fournisseurs professionnels réellement existants et pertinents. " +
        "N'invente jamais une société, un e-mail ou une URL. Un fournisseur n'est admissible que si son e-mail professionnel public est visible sur son propre site officiel ou une page officielle de contact. " +
        "Privilégie les e-mails génériques professionnels (contact@, commercial@, devis@, agence@) et refuse les adresses personnelles ou celles trouvées uniquement sur des annuaires non officiels. " +
        "Retourne uniquement des fournisseurs qui vendent réellement les familles ou produits demandés en France. source_url doit être la page exacte qui justifie l\'e-mail ou le contact. " +
        "categories doit reprendre uniquement des libellés exacts de la liste de familles fournie. matched_codes doit contenir uniquement les références exactes des lignes que ce fournisseur peut réellement chiffrer.",
      input: `Chantier: ${input.projectName}${input.projectReference ? ` — réf. ${input.projectReference}` : ""}

Familles recherchées:
${input.categories.join(", ") || "matériaux BTP divers"}

Lignes principales:
${lineSummary}

Trouve au maximum ${limit} fournisseurs distincts en France. Ne retourne aucun fournisseur sans e-mail professionnel public vérifiable.`,
      text: { format: zodTextFormat(SupplierDiscoverySchema, "supplier_discovery") },
    });

    if (response.status === "incomplete") throw new AiFailure("truncated");
    if (response.output_parsed == null) throw new AiFailure("invalid_output", "aucune sortie fournisseur");
    const parsed = SupplierDiscoverySchema.safeParse(response.output_parsed);
    if (!parsed.success) throw new AiFailure("invalid_output", parsed.error.issues[0]?.message);

    const seen = new Set<string>();
    return parsed.data.suppliers
      .filter((s) => {
        const email = s.email.trim().toLowerCase();
        if (seen.has(email)) return false;
        seen.add(email);
        try {
          const website = new URL(s.website);
          const source = new URL(s.source_url);
          return website.protocol.startsWith("http") && source.protocol.startsWith("http");
        } catch {
          return false;
        }
      })
      .slice(0, limit);
  } catch (err) {
    if (err instanceof APIError) {
      console.error("[supplier-discovery] OpenAI", { status: err.status, code: err.code, message: err.message });
      throw new Error(`supplier-discovery HTTP ${err.status ?? "?"} ${String(err.code ?? "")}: ${err.message}`);
    }
    throw classifyOpenAiError(err);
  }
}
