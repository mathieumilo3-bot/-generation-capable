import Link from "next/link";
import { Bot, CheckCircle2, Clock3, Inbox, MailCheck, Plus, RefreshCcw, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, ProjectStatusBadge } from "@/components/page";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { frDate } from "@/lib/format";

export const metadata = { title: "Dossiers — PrixChantier" };

export default async function DashboardPage() {
  await requireSession();
  const supabase = await createClient();

  const [
    { data: projects, error },
    { count: unassigned },
    { data: consultations },
    { data: responses },
    { data: offers },
    { data: followups },
  ] = await Promise.all([
    supabase.from("project_overview").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_responses").select("id", { count: "exact", head: true }).eq("status", "needs_assignment"),
    supabase.from("consultations").select("id,status,sent_at"),
    supabase.from("supplier_responses").select("id,status"),
    supabase.from("offers").select("id,is_current").eq("is_current", true),
    supabase.from("scheduled_followups").select("id,status,due_at").eq("status", "scheduled"),
  ]);

  if (error) throw new Error("Impossible de charger les dossiers.");

  const sentCount = (consultations ?? []).filter((x) => Boolean(x.sent_at)).length;
  const processedResponses = (responses ?? []).filter((x) => x.status === "processed").length;
  const offerCount = offers?.length ?? 0;
  const scheduledCount = followups?.length ?? 0;
  const activeCount = (projects ?? []).filter((p) => !["termine", "ferme"].includes(String(p.status))).length;

  return (
    <>
      <div className="mb-8 overflow-hidden rounded-2xl border bg-background">
        <div className="border-b bg-muted/30 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Bot className="size-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">Pilote achat</h1>
                  <Badge variant="success">Autonome</Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Déposez votre DPGF. PrixChantier analyse le besoin, trouve les fournisseurs, envoie les demandes, relance et prépare le comparatif.
                </p>
              </div>
            </div>
            <Button asChild size="lg">
              <Link href="/dossiers/nouveau">
                <Plus /> Déposer un DPGF
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          <div className="bg-background p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Dossiers actifs</div>
            <div className="text-2xl font-semibold tabular">{activeCount}</div>
          </div>
          <div className="bg-background p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MailCheck className="size-3.5" /> Demandes envoyées</div>
            <div className="text-2xl font-semibold tabular">{sentCount}</div>
          </div>
          <div className="bg-background p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" /> Réponses traitées</div>
            <div className="text-2xl font-semibold tabular">{processedResponses}</div>
          </div>
          <div className="bg-background p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCcw className="size-3.5" /> Relances prévues</div>
            <div className="text-2xl font-semibold tabular">{scheduledCount}</div>
          </div>
          <div className="col-span-2 bg-background p-4 sm:col-span-1 sm:p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Scale className="size-3.5" /> Offres comparées</div>
            <div className="text-2xl font-semibold tabular">{offerCount}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 border-t px-5 py-3 text-sm text-muted-foreground sm:px-7">
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <span>Le moteur tourne côté serveur : vous pouvez fermer PrixChantier, les traitements et relances continuent.</span>
        </div>
      </div>

      {unassigned ? (
        <Alert variant="warning" className="mb-6">
          <Inbox />
          <AlertTitle>
            {unassigned} réponse{unassigned > 1 ? "s" : ""} à rattacher
          </AlertTitle>
          <AlertDescription>
            <p>
              PrixChantier n&apos;a pas pu rattacher automatiquement ces réponses avec certitude.{" "}
              <Link href="/reponses" className="font-medium text-foreground underline underline-offset-4">
                Les vérifier
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title="Dossiers"
        description="Suivez ce que le pilote automatique est en train de traiter."
        actions={
          projects?.length ? (
            <Button asChild variant="outline">
              <Link href="/dossiers/nouveau">
                <Plus /> Nouveau dossier
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!projects?.length ? (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              title="Déposez votre premier DPGF"
              description="Vous fournissez le dossier. PrixChantier s'occupe ensuite de l'analyse, du sourcing fournisseurs, des demandes de prix, des relances et du comparatif."
              action={
                <Button asChild size="lg">
                  <Link href="/dossiers/nouveau">
                    <Plus /> Déposer un DPGF
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Dossier</TableHead>
                <TableHead className="hidden md:table-cell">Référence</TableHead>
                <TableHead className="hidden lg:table-cell">Client / chantier</TableHead>
                <TableHead className="hidden sm:table-cell">Date limite</TableHead>
                <TableHead className="text-right">Demandes</TableHead>
                <TableHead className="text-right">Réponses</TableHead>
                <TableHead className="pr-5">Pilote</TableHead>
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
                  <TableCell className="text-right tabular">{p.sent_count || p.consultations_count || "—"}</TableCell>
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
