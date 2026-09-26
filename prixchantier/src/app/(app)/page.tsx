import Link from "next/link";
import { Plus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState, PageHeader, ProjectStatusBadge } from "@/components/page";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { frDate } from "@/lib/format";

export const metadata = { title: "Dossiers — PrixChantier" };

export default async function DashboardPage() {
  await requireSession();
  const supabase = await createClient();
  const [{ data: projects, error }, { count: unassigned }] = await Promise.all([
    supabase.from("project_overview").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_responses").select("id", { count: "exact", head: true }).eq("status", "needs_assignment"),
  ]);
  if (error) throw new Error("Impossible de charger les dossiers.");

  return (
    <>
      <PageHeader
        title="Dossiers"
        description="Vos consultations fournisseurs, dossier par dossier."
        actions={
          <Button asChild size="lg">
            <Link href="/dossiers/nouveau">
              <Plus /> Nouveau dossier
            </Link>
          </Button>
        }
      />

      {unassigned ? (
        <Alert variant="warning" className="mb-6">
          <Inbox />
          <AlertTitle>
            {unassigned} réponse{unassigned > 1 ? "s" : ""} à rattacher
          </AlertTitle>
          <AlertDescription>
            <p>
              Nous n&apos;avons pas réussi à rattacher automatiquement ces réponses : le fournisseur a plusieurs consultations en cours.{" "}
              <Link href="/reponses" className="font-medium text-foreground underline underline-offset-4">
                Les rattacher
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {!projects?.length ? (
        <EmptyState
          title="Aucun dossier pour l'instant"
          description="Importez un DPGF : nous extrayons les lignes, vous choisissez vos fournisseurs, nous suivons leurs réponses."
          action={
            <Button asChild>
              <Link href="/dossiers/nouveau">
                <Plus /> Nouveau dossier
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Dossier</TableHead>
                <TableHead className="hidden md:table-cell">Référence</TableHead>
                <TableHead className="hidden lg:table-cell">Client / chantier</TableHead>
                <TableHead className="hidden sm:table-cell">Date limite</TableHead>
                <TableHead className="text-right">Consultations</TableHead>
                <TableHead className="text-right">Réponses</TableHead>
                <TableHead className="pr-5">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id!} className="relative">
                  <TableCell className="pl-5 font-medium">
                    <Link href={`/dossiers/${p.id}`} className="after:absolute after:inset-0">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.reference || "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{p.client || "—"}</TableCell>
                  <TableCell className="hidden tabular text-muted-foreground sm:table-cell">{frDate(p.response_deadline)}</TableCell>
                  <TableCell className="text-right tabular">{p.consultations_count}</TableCell>
                  <TableCell className="text-right tabular">
                    {p.sent_count ? `${p.responded_count} / ${p.sent_count}` : "—"}
                  </TableCell>
                  <TableCell className="pr-5">
                    <ProjectStatusBadge status={p.status!} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
