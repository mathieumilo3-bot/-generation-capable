import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "./draft-card";

export const metadata = { title: "Valider les envois — PrixChantier" };

export default async function SendPage({ params }: PageProps<"/dossiers/[id]/consultations/envoi">) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) notFound();
  const [{ data: drafts }, { data: connections }, { data: docs }] = await Promise.all([
    supabase
      .from("consultations")
      .select("id, subject, body, status, error, include_excel, auto_followup, attached_document_ids, reference_code, suppliers(company_name, contact_name, email), consultation_lines(count)")
      .eq("project_id", id)
      .in("status", ["a_envoyer", "erreur"])
      .order("created_at"),
    supabase.from("mail_connections").select("id, email, status, provider, user_id"),
    supabase.from("project_documents").select("id, file_name").eq("project_id", id),
  ]);
  const conn = connections?.find((c) => c.user_id === session.userId) ?? connections?.[0];
  const docNames = new Map((docs ?? []).map((d) => [d.id, d.file_name]));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: `/dossiers/${id}?tab=consultations`, label: project.name }}
        title="Valider les envois"
        description="Relisez chaque e-mail. Il part depuis votre boîte uniquement quand vous cliquez sur « Envoyer la consultation »."
      />
      {!conn ? (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Aucune boîte mail connectée</AlertTitle>
          <AlertDescription>
            <p>
              <Link href="/parametres" className="font-medium text-foreground underline underline-offset-4">
                Connectez Gmail ou Microsoft 365
              </Link>{" "}
              pour envoyer vos consultations.
            </p>
          </AlertDescription>
        </Alert>
      ) : conn.status !== "active" ? (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertTitle>{conn.provider === "microsoft" ? "Votre connexion Microsoft a expiré." : "Votre connexion Gmail a expiré."}</AlertTitle>
          <AlertDescription>
            <p>
              <Link href="/parametres" className="font-medium text-foreground underline underline-offset-4">
                Reconnectez votre boîte mail
              </Link>{" "}
              puis revenez ici.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {!drafts?.length ? (
        <EmptyState
          title="Toutes les consultations ont été envoyées"
          action={
            <Button asChild>
              <Link href={`/dossiers/${id}?tab=consultations`}>Suivre les réponses</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={{
                id: d.id,
                subject: d.subject,
                body: d.body,
                status: d.status,
                error: d.error,
                includeExcel: d.include_excel,
                autoFollowup: d.auto_followup,
                referenceCode: d.reference_code,
                lineCount: d.consultation_lines[0]?.count ?? 0,
                supplier: d.suppliers!,
                attachments: d.attached_document_ids.map((x) => docNames.get(x) ?? "Document"),
              }}
              fromEmail={conn?.status === "active" ? conn.email : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
