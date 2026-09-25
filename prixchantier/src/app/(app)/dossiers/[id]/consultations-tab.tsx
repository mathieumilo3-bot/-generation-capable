import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConsultationStatusBadge, EmptyState } from "@/components/page";
import { createClient } from "@/lib/supabase/server";
import { frDate, relativeDateTime } from "@/lib/format";
import { AWAITING, RESPONDED } from "@/lib/labels";
import { CheckMailButton, ConsultationActions } from "./consultations-client";

export async function ConsultationsTab({ projectId, closed }: { projectId: string; closed: boolean }) {
  const supabase = await createClient();
  const { data: consultations } = await supabase
    .from("consultations")
    .select(
      "id, status, sent_at, responded_at, response_due_date, auto_followup, followup_count, last_followup_at, error, reference_code, suppliers(company_name, email), consultation_lines(count), scheduled_followups(due_at, status)",
    )
    .eq("project_id", projectId)
    .order("created_at");

  if (!consultations?.length) {
    return (
      <EmptyState
        title="Aucune consultation"
        description="Sélectionnez les lignes à chiffrer et les fournisseurs : nous préparons un e-mail et un fichier Excel pour chacun."
        action={
          closed ? undefined : (
            <Button asChild>
              <Link href={`/dossiers/${projectId}/consultations/nouvelle`}>
                <Plus /> Créer une consultation
              </Link>
            </Button>
          )
        }
      />
    );
  }

  const active = consultations.filter((c) => c.status !== "annulee" && c.status !== "a_envoyer");
  const responded = active.filter((c) => RESPONDED.has(c.status)).length;
  const hasAwaiting = consultations.some((c) => AWAITING.has(c.status));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-semibold tabular">
            {responded} / {active.length}
          </span>{" "}
          fournisseurs ont répondu
        </p>
        <div className="flex flex-wrap gap-2">
          {hasAwaiting ? <CheckMailButton projectId={projectId} /> : null}
          {!closed ? (
            <Button asChild variant="outline">
              <Link href={`/dossiers/${projectId}/consultations/nouvelle`}>
                <Plus /> Créer une consultation
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Fournisseur</TableHead>
              <TableHead className="text-right">Lignes</TableHead>
              <TableHead className="hidden md:table-cell">Envoyée</TableHead>
              <TableHead className="hidden lg:table-cell">Relances</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {consultations.map((c) => {
              const next = c.scheduled_followups.filter((f) => f.status === "scheduled").sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
              return (
                <TableRow key={c.id} data-testid="consultation-row">
                  <TableCell className="pl-5">
                    <div className="font-medium">{c.suppliers?.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.suppliers?.email} · {c.reference_code}
                    </div>
                    {c.error && c.status !== "repondu" ? <div className="mt-1 text-xs text-destructive">{c.error}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular">{c.consultation_lines[0]?.count ?? 0}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{c.sent_at ? relativeDateTime(c.sent_at) : "—"}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {c.followup_count ? `${c.followup_count} envoyée${c.followup_count > 1 ? "s" : ""}` : "—"}
                    {next && c.auto_followup ? <div className="text-xs">Prochaine : {frDate(next.due_at)}</div> : null}
                    {!c.auto_followup && AWAITING.has(c.status) ? <div className="text-xs">Relance auto désactivée</div> : null}
                  </TableCell>
                  <TableCell>
                    <ConsultationStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <ConsultationActions
                      id={c.id}
                      projectId={projectId}
                      status={c.status}
                      autoFollowup={c.auto_followup}
                      supplierName={c.suppliers?.company_name ?? ""}
                      closed={closed}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
