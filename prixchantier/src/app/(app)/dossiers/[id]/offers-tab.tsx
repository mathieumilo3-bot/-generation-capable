import { Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ResponseStatusBadge, ToVerify } from "@/components/page";
import { createClient } from "@/lib/supabase/server";
import { euros, euros2, frDate, quantity, relativeDateTime } from "@/lib/format";
import { CLASSIFICATION, MATCH_METHOD } from "@/lib/labels";
import type { StoredFile } from "@/lib/workflows/responses";
import { OfferLineMatch, RetryResponseButton } from "./offers-client";

type FieldInfo = { value: unknown; confidence: number; source_excerpt: string | null; page: number | null };

function Value({ value, field }: { value: string | null; field?: FieldInfo }) {
  if (value) return <span>{value}</span>;
  if (field && field.value !== null && field.confidence < 0.6) return <ToVerify />;
  return <span className="text-muted-foreground">Non précisé</span>;
}

export async function OffersTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const [{ data: responses }, { data: requested }] = await Promise.all([
    supabase
      .from("supplier_responses")
      .select("*, suppliers(company_name), email_messages(subject, body_text, from_email, message_at), offers(*, offer_lines(*))")
      .eq("project_id", projectId)
      .order("received_at", { ascending: false }),
    supabase
      .from("consultation_lines")
      .select("consultation_id, project_lines(id, code, designation), consultations!inner(project_id)")
      .eq("consultations.project_id", projectId),
  ]);
  if (!responses?.length) {
    return <EmptyState title="Aucune réponse pour l'instant" description="Les réponses des fournisseurs apparaissent ici automatiquement, avec leurs pièces jointes." />;
  }
  const requestedByConsultation = new Map<string, { id: string; label: string }[]>();
  for (const r of requested ?? []) {
    if (!r.project_lines) continue;
    const list = requestedByConsultation.get(r.consultation_id) ?? [];
    list.push({ id: r.project_lines.id, label: `${r.project_lines.code ? `${r.project_lines.code} — ` : ""}${r.project_lines.designation}` });
    requestedByConsultation.set(r.consultation_id, list);
  }

  return (
    <div className="grid gap-6">
      {responses.map((r) => {
        const files = (r.files as unknown as StoredFile[]) ?? [];
        const offer = r.offers.find((o) => o.is_current) ?? r.offers[0];
        const fields = ((offer?.extraction as { fields?: Record<string, FieldInfo> } | null)?.fields ?? {}) as Record<string, FieldInfo>;
        const lines = offer ? [...offer.offer_lines].sort((a, b) => a.position - b.position) : [];
        const options = requestedByConsultation.get(r.consultation_id ?? "") ?? [];
        return (
          <Card key={r.id} data-testid="response-card">
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {r.suppliers?.company_name ?? r.email_messages?.from_email}
                  <ResponseStatusBadge status={r.status} />
                  {r.classification ? <Badge variant="neutral">{CLASSIFICATION[r.classification]}</Badge> : null}
                  {offer && !offer.is_current ? <Badge variant="outline">Remplacée par une offre plus récente</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Reçue {relativeDateTime(r.received_at).toLowerCase()}
                  {r.match_method ? ` · rattachée par ${MATCH_METHOD[r.match_method]}` : ""}
                </div>
                {r.error ? <p className="mt-2 text-sm text-destructive">{r.error}</p> : null}
              </div>
              {r.status === "failed" ? <RetryResponseButton responseId={r.id} /> : null}
            </CardHeader>
            <CardContent className="grid gap-5">
              {files.length ? (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f) => (
                    <li key={`${f.name}-${f.path}`}>
                      {f.path ? (
                        <a
                          href={`/api/files?path=${encodeURIComponent(f.path)}&name=${encodeURIComponent(f.name)}`}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
                        >
                          <Paperclip className="size-3.5" /> {f.name}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-sm text-muted-foreground">
                          <Paperclip className="size-3.5" /> {f.name} — {f.skipped}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {r.email_messages?.body_text ? (
                <details className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Message : {r.email_messages.subject}</summary>
                  <p className="mt-2 whitespace-pre-line">{r.email_messages.body_text.slice(0, 4000)}</p>
                </details>
              ) : null}
              {offer ? (
                <>
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Total HT</dt>
                      <dd className="font-medium">
                        {offer.total_ht !== null ? euros(offer.total_ht) : <Value value={null} field={fields.total_ht} />}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Référence devis</dt>
                      <dd>
                        <Value value={offer.quote_reference} field={fields.quote_reference} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Validité</dt>
                      <dd>
                        <Value value={offer.validity_date ? frDate(offer.validity_date) : null} field={fields.validity_date} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Délai</dt>
                      <dd>
                        <Value value={offer.delivery_delay} field={fields.delivery_delay} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Conditions de paiement</dt>
                      <dd>
                        <Value value={offer.payment_terms} field={fields.payment_terms} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Livraison / mise en service</dt>
                      <dd>
                        {offer.delivery_included === "no" ? "Livraison non incluse" : offer.delivery_included === "yes" ? "Livraison incluse" : "Livraison non précisée"}
                        {" · "}
                        {offer.commissioning_included === "no" ? "MES exclue" : offer.commissioning_included === "yes" ? "MES incluse" : "MES non précisée"}
                      </dd>
                    </div>
                  </dl>
                  {offer.exclusions.length ? (
                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground">Exclusions</div>
                      <ul className="list-disc pl-5">
                        {offer.exclusions.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Ligne du devis</th>
                          <th className="px-3 py-2 text-right font-medium">Qté</th>
                          <th className="px-3 py-2 text-right font-medium">PU HT</th>
                          <th className="px-3 py-2 text-right font-medium">Total HT</th>
                          <th className="px-3 py-2 text-left font-medium">Rattachée à</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => (
                          <tr key={l.id} className="border-b last:border-0 align-top">
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {l.supplier_reference ? <span className="font-mono text-xs text-muted-foreground">{l.supplier_reference}</span> : null}
                                <span>{l.supplier_designation}</span>
                                {l.is_alternative ? <Badge variant="warning">Variante</Badge> : null}
                                {l.is_fee ? <Badge variant="neutral">Frais</Badge> : null}
                                {l.confidence !== null && l.confidence < 0.6 ? <ToVerify /> : null}
                              </div>
                              {l.alternative_note ? <div className="text-xs text-muted-foreground">{l.alternative_note}</div> : null}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap tabular">
                              {quantity(l.quantity)} {l.unit ?? ""}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap tabular">{euros2(l.unit_price)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap tabular">{euros2(l.total_price)}</td>
                            <td className="px-3 py-2">
                              <OfferLineMatch offerLineId={l.id} status={l.match_status} projectLineId={l.project_line_id} options={options} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
