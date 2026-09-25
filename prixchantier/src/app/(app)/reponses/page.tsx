import { PageHeader, EmptyState } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { relativeDateTime } from "@/lib/format";
import { AssignForm } from "./assign-form";

export const metadata = { title: "Réponses à rattacher — PrixChantier" };

/** Réponses d'un fournisseur ayant plusieurs consultations en cours : l'utilisateur choisit. */
export default async function UnassignedPage() {
  await requireSession();
  const supabase = await createClient();
  const { data: responses } = await supabase
    .from("supplier_responses")
    .select("id, supplier_id, received_at, suppliers(company_name), email_messages(subject, body_text)")
    .eq("status", "needs_assignment")
    .order("received_at", { ascending: false });
  const supplierIds = [...new Set((responses ?? []).map((r) => r.supplier_id).filter((x): x is string => Boolean(x)))];
  const { data: consultations } = supplierIds.length
    ? await supabase
        .from("consultations")
        .select("id, supplier_id, reference_code, sent_at, projects(name)")
        .in("supplier_id", supplierIds)
        .not("status", "in", "(a_envoyer,annulee)")
        .order("sent_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/", label: "Dossiers" }} title="Réponses à rattacher" description="Indiquez à quelle consultation correspond chaque réponse." />
      {!responses?.length ? (
        <EmptyState title="Aucune réponse en attente de rattachement" />
      ) : (
        <div className="grid gap-4">
          {responses.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.suppliers?.company_name}</CardTitle>
                <CardDescription>
                  {relativeDateTime(r.received_at)} — {r.email_messages?.subject}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {r.email_messages?.body_text ? <p className="line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{r.email_messages.body_text}</p> : null}
                <AssignForm
                  responseId={r.id}
                  options={(consultations ?? [])
                    .filter((c) => c.supplier_id === r.supplier_id)
                    .map((c) => ({ id: c.id, label: `${c.projects?.name ?? "Dossier"} — ${c.reference_code}` }))}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
