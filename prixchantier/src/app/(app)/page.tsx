import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Inbox,
  MailCheck,
  Plus,
  RefreshCcw,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ProjectStatusBadge } from "@/components/page";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { frDate, relativeDateTime } from "@/lib/format";

export const metadata = { title: "Accueil — PrixChantier" };

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
    { data: recentConsultations },
  ] = await Promise.all([
    supabase.from("project_overview").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_responses").select("id", { count: "exact", head: true }).eq("status", "needs_assignment"),
    supabase.from("consultations").select("id,status,sent_at,error"),
    supabase.from("supplier_responses").select("id,status"),
    supabase.from("offers").select("id,is_current").eq("is_current", true),
    supabase.from("scheduled_followups").select("id,status,due_at").eq("status", "scheduled"),
    supabase
      .from("consultations")
      .select("id,reference_code,status,sent_at,responded_at,error,suppliers(company_name,email),projects(id,name,reference)")
      .not("status", "eq", "a_envoyer")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (error) throw new Error("Impossible de charger les dossiers.");

  const sentCount = (consultations ?? []).filter((x) => Boolean(x.sent_at)).length;
  const processedResponses = (responses ?? []).filter((x) => x.status === "processed").length;
  const offerCount = offers?.length ?? 0;
  const scheduledCount = followups?.length ?? 0;
  const activeProjects = (projects ?? []).filter((p) => !p.closed_at);
  const errors = (consultations ?? []).filter((x) => x.status === "erreur").length;
  const waiting = (consultations ?? []).filter((x) => ["envoye", "relance_prevue", "relance"].includes(x.status)).length;
  const actionCount = Number(unassigned ?? 0) + errors;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
                <Bot className="size-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pilote achat</h1>
                  <Badge variant="success">Autonome</Badge>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Déposez un DPGF. PrixChantier trouve les fournisseurs, envoie les demandes, relance, récupère les offres et prépare le comparatif.
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dossiers/nouveau">
                <Plus /> Déposer un DPGF
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t sm:grid-cols-5">
          {[
            { label: "Dossiers actifs", value: activeProjects.length, Icon: Sparkles },
            { label: "Demandes envoyées", value: sentCount, Icon: MailCheck },
            { label: "Réponses traitées", value: processedResponses, Icon: CheckCircle2 },
            { label: "Relances prévues", value: scheduledCount, Icon: RefreshCcw },
            { label: "Offres comparées", value: offerCount, Icon: Scale },
          ].map(({ label, value, Icon }, i) => (
            <div key={String(label)} className={"border-border p-4 sm:p-5 " + (i < 4 ? "border-r border-b sm:border-b-0" : "col-span-2 sm:col-span-1")}>
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" /> {label}
              </div>
              <div className="text-2xl font-semibold tabular">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 border-t bg-muted/20 px-5 py-3 text-sm text-muted-foreground sm:px-7">
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <span>{waiting ? `${waiting} fournisseur${waiting > 1 ? "s" : ""} actuellement suivi${waiting > 1 ? "s" : ""}.` : "Aucune consultation en attente."} Le moteur continue même si vous fermez l’application.</span>
        </div>
      </section>

      {actionCount ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">À traiter maintenant</h2>
              <p className="text-sm text-muted-foreground">Seulement les éléments qui nécessitent votre intervention.</p>
            </div>
            <Badge variant="warning">{actionCount}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {unassigned ? (
              <Link href="/reponses" className="group rounded-xl border bg-background p-4 transition hover:border-foreground/20 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning"><Inbox className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{unassigned} réponse{unassigned > 1 ? "s" : ""} à rattacher</div>
                    <div className="mt-1 text-sm text-muted-foreground">Le fournisseur a plusieurs consultations possibles.</div>
                  </div>
                  <ArrowRight className="mt-2 size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ) : null}
            {errors ? (
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive"><AlertCircle className="size-4" /></span>
                  <div>
                    <div className="font-medium">{errors} envoi{errors > 1 ? "s" : ""} en erreur</div>
                    <div className="mt-1 text-sm text-muted-foreground">Ouvrez le dossier concerné pour corriger l’adresse ou la connexion mail.</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Dossiers en cours</h2>
            <p className="text-sm text-muted-foreground">Où en est chaque consultation.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dossiers/nouveau"><Plus /> Nouveau</Link>
          </Button>
        </div>

        {!projects?.length ? (
          <Card>
            <CardContent className="py-14">
              <EmptyState
                title="Déposez votre premier DPGF"
                description="Le pilote s'occupe ensuite du sourcing, des demandes de prix, des relances et du comparatif."
                action={<Button asChild size="lg"><Link href="/dossiers/nouveau"><Plus /> Déposer un DPGF</Link></Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {projects.slice(0, 8).map((p) => {
              const sent = Number(p.sent_count ?? 0);
              const responded = Number(p.responded_count ?? 0);
              const pct = sent ? Math.round((responded / sent) * 100) : 0;
              return (
                <Link key={p.id!} href={`/dossiers/${p.id}`} className="group rounded-xl border bg-background p-4 transition hover:border-foreground/20 hover:shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><FileSpreadsheet className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold">{p.name}</div>
                        <ProjectStatusBadge status={p.status!} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[p.reference, p.client, p.response_deadline ? `échéance ${frDate(p.response_deadline)}` : null].filter(Boolean).join(" · ") || "Aucune information complémentaire"}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div><span className="font-semibold tabular">{p.consultations_count ?? 0}</span><span className="ml-1 text-muted-foreground">fourn.</span></div>
                        <div><span className="font-semibold tabular">{sent}</span><span className="ml-1 text-muted-foreground">envoyées</span></div>
                        <div><span className="font-semibold tabular">{responded}</span><span className="ml-1 text-muted-foreground">réponses</span></div>
                      </div>
                      {sent ? (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Derniers fournisseurs contactés</h2>
            <p className="text-sm text-muted-foreground">Qui a été contacté, pour quel dossier et où en est la réponse.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/fournisseurs">Voir le carnet</Link>
          </Button>
        </div>

        {!recentConsultations?.length ? (
          <div className="rounded-xl border border-dashed bg-background px-5 py-10 text-center text-sm text-muted-foreground">Aucun fournisseur contacté pour le moment.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="divide-y">
              {recentConsultations.map((c) => {
                const status =
                  c.status === "erreur" ? { label: "Erreur", variant: "danger" as const } :
                  c.status === "refus" ? { label: "Refus", variant: "neutral" as const } :
                  ["repondu", "reponse_partielle"].includes(c.status) ? { label: "Répondu", variant: "success" as const } :
                  c.status === "relance" ? { label: "Relancé", variant: "warning" as const } :
                  { label: "En attente", variant: "info" as const };
                return (
                  <Link key={c.id} href={`/dossiers/${c.projects?.id ?? ""}?tab=consultations`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted/30 sm:px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Building2 className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.suppliers?.company_name ?? "Fournisseur"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.projects?.name ?? "Dossier"} · {c.sent_at ? relativeDateTime(c.sent_at) : c.reference_code}
                      </div>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
