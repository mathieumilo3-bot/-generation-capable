import Link from "next/link";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ProjectStatusBadge, Progress } from "@/components/page";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { frDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./overview-tab";
import { LinesTab } from "./lines-tab";
import { ConsultationsTab } from "./consultations-tab";
import { OffersTab } from "./offers-tab";
import { ComparisonTab } from "./comparison-tab";
import { ProjectMenu } from "./project-menu";
import { RetryAnalysisButton } from "./retry-analysis-button";

const TABS = [
  { key: "general", label: "Vue générale" },
  { key: "lignes", label: "Lignes" },
  { key: "consultations", label: "Consultations" },
  { key: "offres", label: "Offres" },
  { key: "comparatif", label: "Comparatif" },
] as const;

export default async function ProjectPage({ params, searchParams }: PageProps<"/dossiers/[id]">) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "general";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase.from("project_overview").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ count: lineCount }, { count: unvalidated }, { count: drafts }, { count: processing }] = await Promise.all([
    supabase.from("project_lines").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("project_lines").select("id", { count: "exact", head: true }).eq("project_id", id).eq("user_validated", false),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "a_envoyer"),
    supabase.from("supplier_responses").select("id", { count: "exact", head: true }).eq("project_id", id).in("status", ["pending", "processing"]),
  ]);

  const analyzing = project.analysis_status === "pending" || project.analysis_status === "running";
  const closed = Boolean(project.closed_at);

  let primary: React.ReactNode = null;
  if (analyzing) {
    primary = (
      <Button size="lg" disabled>
        <Loader2 className="animate-spin" /> Analyse en cours
      </Button>
    );
  } else if (closed) {
    primary = null;
  } else if (project.analysis_status === "failed" && !lineCount) {
    primary = <RetryAnalysisButton projectId={id} />;
  } else if (lineCount && unvalidated && tab !== "lignes") {
    primary = (
      <Button asChild size="lg">
        <Link href={`/dossiers/${id}?tab=lignes`}>Vérifier les lignes</Link>
      </Button>
    );
  } else if (drafts) {
    primary = (
      <Button asChild size="lg">
        <Link href={`/dossiers/${id}/consultations/envoi`}>Valider les envois ({drafts})</Link>
      </Button>
    );
  } else if (lineCount && !project.consultations_count) {
    primary = (
      <Button asChild size="lg">
        <Link href={`/dossiers/${id}/consultations/nouvelle`}>Créer une consultation</Link>
      </Button>
    );
  } else if (project.offers_count && tab !== "comparatif") {
    primary = (
      <Button asChild size="lg">
        <Link href={`/dossiers/${id}?tab=comparatif`}>Voir le comparatif</Link>
      </Button>
    );
  }

  const meta = [project.reference, project.client, project.response_deadline ? `Réponses avant le ${frDate(project.response_deadline)}` : null].filter(Boolean);

  return (
    <>
      <AutoRefresh active={analyzing || Boolean(processing)} />
      <PageHeader
        back={{ href: "/", label: "Dossiers" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.name}
            <ProjectStatusBadge status={project.status!} />
          </span>
        }
        description={meta.length ? meta.join(" · ") : undefined}
        actions={
          <>
            {primary}
            <ProjectMenu
              projectId={id}
              closed={closed}
              values={{ name: project.name!, reference: project.reference, client: project.client, responseDeadline: project.response_deadline }}
            />
          </>
        }
      >
        {project.sent_count ? (
          <div className="mt-6 max-w-md">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span>
                <span className="font-semibold tabular">
                  {project.responded_count} / {project.sent_count}
                </span>{" "}
                fournisseurs ont répondu
              </span>
            </div>
            <Progress value={project.responded_count ?? 0} max={project.sent_count ?? 0} />
          </div>
        ) : null}
      </PageHeader>

      <nav className="mb-8 flex gap-1 overflow-x-auto border-b" aria-label="Sections du dossier">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "general" ? `/dossiers/${id}` : `/dossiers/${id}?tab=${t.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.key === "lignes" && lineCount ? <span className="ml-1.5 text-xs text-muted-foreground tabular">{lineCount}</span> : null}
            {t.key === "consultations" && project.consultations_count ? (
              <span className="ml-1.5 text-xs text-muted-foreground tabular">{project.consultations_count}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {tab === "general" ? <OverviewTab projectId={id} closed={closed} /> : null}
      {tab === "lignes" ? <LinesTab projectId={id} closed={closed} /> : null}
      {tab === "consultations" ? <ConsultationsTab projectId={id} closed={closed} /> : null}
      {tab === "offres" ? <OffersTab projectId={id} /> : null}
      {tab === "comparatif" ? <ComparisonTab projectId={id} /> : null}
    </>
  );
}
