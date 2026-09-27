import { AlertTriangle, Bot, CheckCircle2, Clock3, FileSpreadsheet, FileText, Loader2, MailCheck, RefreshCcw, Scale, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { DOC_KIND } from "@/lib/labels";
import { relativeDateTime } from "@/lib/format";
import { DocumentActions, AddDocuments } from "./documents-client";
import { RetryAnalysisButton } from "./retry-analysis-button";

type Summary = {
  total_lines: number;
  warnings: string[];
  documents: { name: string; lines: number; method: string; warnings: string[]; sheets?: { name: string; status: string; reason?: string; lines: number; ignoredTotals: number }[] }[];
};

const METHOD: Record<string, string> = {
  tableur: "lecture directe du tableau",
  ia_texte: "lecture IA du texte",
  ia_scan: "lecture visuelle (document scanné)",
  aucune: "aucune ligne",
};

export async function OverviewTab({ projectId, closed }: { projectId: string; closed: boolean }) {
  const supabase = await createClient();
  const [
    { data: project },
    { data: documents },
    { data: activity },
    { data: consultations },
    { data: responses },
    { data: offers },
    { data: followups },
  ] = await Promise.all([
    supabase.from("projects").select("analysis_status, analysis_error, analysis_summary").eq("id", projectId).single(),
    supabase.from("project_documents").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("activity_logs").select("id, message, created_at, type").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40),
    supabase.from("consultations").select("id, status, sent_at, responded_at, error").eq("project_id", projectId),
    supabase.from("supplier_responses").select("id, status, classification").eq("project_id", projectId),
    supabase.from("offers").select("id, consultation_id, is_current").eq("project_id", projectId).eq("is_current", true),
    supabase
      .from("scheduled_followups")
      .select("id, status, due_at, consultations!inner(project_id)")
      .eq("consultations.project_id", projectId),
  ]);
  const summary = project?.analysis_summary as Summary | null;
  const analyzing = project?.analysis_status === "pending" || project?.analysis_status === "running";
  const toAnalyze = documents?.some((d) => d.kind === "dpgf" && (d.status === "uploaded" || d.status === "failed"));

  const sentCount = (consultations ?? []).filter((x) => !["a_envoyer", "annulee"].includes(x.status)).length;
  const responseCount = (responses ?? []).filter((x) => x.status === "processed").length;
  const offerCount = offers?.length ?? 0;
  const scheduledFollowups = (followups ?? []).filter((x) => x.status === "scheduled").length;
  const errorCount = (consultations ?? []).filter((x) => x.status === "erreur").length;
  const waitingCount = (consultations ?? []).filter((x) => ["envoye", "relance_prevue", "relance"].includes(x.status)).length;
  const autopilotStarted = (activity ?? []).some((a) => ["autopilot_launched", "auto_launch"].includes(a.type));
  const autopilotFailed = (activity ?? []).find((a) => a.type === "autopilot_failed");

  const autopilotLabel = analyzing
    ? "Analyse du dossier"
    : autopilotFailed && !autopilotStarted
      ? "Action requise"
      : sentCount
        ? waitingCount
          ? "En attente des fournisseurs"
          : offerCount
            ? "Comparatif alimenté"
            : "Consultations traitées"
        : summary?.total_lines
          ? "Prêt à consulter"
          : "En attente du DPGF";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 content-start gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </span>
                <div>
                  <CardTitle>Pilote automatique</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {autopilotLabel} · le traitement continue même si vous fermez PrixChantier.
                  </p>
                </div>
              </div>
              <Badge variant={errorCount || (autopilotFailed && !autopilotStarted) ? "danger" : sentCount ? "success" : analyzing ? "info" : "neutral"}>
                {errorCount || (autopilotFailed && !autopilotStarted) ? "À vérifier" : sentCount ? "Actif" : analyzing ? "En cours" : "Prêt"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MailCheck className="size-3.5" /> Demandes</div>
                <div className="text-2xl font-semibold tabular">{sentCount}</div>
                <div className="text-xs text-muted-foreground">envoyées</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" /> Réponses</div>
                <div className="text-2xl font-semibold tabular">{responseCount}</div>
                <div className="text-xs text-muted-foreground">traitées</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCcw className="size-3.5" /> Relances</div>
                <div className="text-2xl font-semibold tabular">{scheduledFollowups}</div>
                <div className="text-xs text-muted-foreground">programmées</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Scale className="size-3.5" /> Offres</div>
                <div className="text-2xl font-semibold tabular">{offerCount}</div>
                <div className="text-xs text-muted-foreground">au comparatif</div>
              </div>
            </div>

            {waitingCount ? (
              <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {waitingCount} fournisseur{waitingCount > 1 ? "s" : ""} encore attendu{waitingCount > 1 ? "s" : ""}. PrixChantier surveille la boîte mail et relancera automatiquement si nécessaire.
                </span>
              </div>
            ) : null}

            {autopilotFailed && !autopilotStarted ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Le pilote automatique a rencontré un blocage</AlertTitle>
                <AlertDescription>{autopilotFailed.message}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {analyzing ? (
          <Alert variant="info">
            <Loader2 className="animate-spin" />
            <AlertTitle>Analyse en cours</AlertTitle>
            <AlertDescription>
              Lecture des documents et extraction des lignes. Vous pouvez quitter cette page : l&apos;analyse continue sur le serveur.
            </AlertDescription>
          </Alert>
        ) : null}
        {project?.analysis_status === "failed" || project?.analysis_error ? (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Impossible d&apos;analyser {project.analysis_status === "failed" ? "ce dossier" : "certains documents"}</AlertTitle>
            <AlertDescription>
              <p className="whitespace-pre-line">{project.analysis_error}</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {summary && !analyzing ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {summary.total_lines} ligne{summary.total_lines > 1 ? "s" : ""} détectée{summary.total_lines > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {summary.documents.map((d) => (
                <div key={d.name} className="grid gap-1">
                  <div>
                    <span className="font-medium">{d.name}</span>{" "}
                    <span className="text-muted-foreground">
                      — {d.lines} ligne{d.lines > 1 ? "s" : ""}, {METHOD[d.method] ?? d.method}
                    </span>
                  </div>
                  {d.sheets?.filter((s) => s.status === "skipped").map((s) => (
                    <div key={s.name} className="text-xs text-muted-foreground">
                      Onglet « {s.name} » ignoré : {s.reason}
                    </div>
                  ))}
                  {d.sheets?.some((s) => s.ignoredTotals) ? (
                    <div className="text-xs text-muted-foreground">
                      {d.sheets.reduce((n, s) => n + s.ignoredTotals, 0)} ligne(s) de sous-total / total non reprises.
                    </div>
                  ) : null}
                  {d.warnings.map((w) => (
                    <div key={w} className="flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                    </div>
                  ))}
                </div>
              ))}
              {summary.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Documents</CardTitle>
            {toAnalyze && !analyzing && !closed ? <RetryAnalysisButton projectId={projectId} variant="outline" /> : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            {documents?.length ? (
              <ul className="divide-y rounded-lg border">
                {documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {/\.pdf$/i.test(d.file_name) ? <FileText className="size-4 text-muted-foreground" /> : <FileSpreadsheet className="size-4 text-muted-foreground" />}
                    <a
                      href={`/api/files?path=${encodeURIComponent(d.storage_path)}&name=${encodeURIComponent(d.file_name)}`}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {d.file_name}
                    </a>
                    <Badge variant="neutral">{DOC_KIND[d.kind]}</Badge>
                    {d.status === "processed" ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="size-3.5" /> {d.lines_count ?? 0} lignes{d.used_ocr ? " (scan)" : ""}
                      </span>
                    ) : d.status === "failed" ? (
                      <span className="text-xs text-destructive">{d.error ?? "Échec"}</span>
                    ) : d.status === "processing" ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Analyse…
                      </span>
                    ) : d.status === "skipped" ? (
                      <span className="text-xs text-muted-foreground">Document de référence</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">À analyser</span>
                    )}
                    {!closed ? <DocumentActions documentId={d.id} kind={d.kind} status={d.status} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document.</p>
            )}
            {!closed ? <AddDocuments projectId={projectId} /> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="content-start">
        <CardHeader>
          <CardTitle>Journal d&apos;activité</CardTitle>
        </CardHeader>
        <CardContent>
          {activity?.length ? (
            <ol className="grid gap-4">
              {activity.map((a) => (
                <li key={a.id} className="grid gap-0.5">
                  <span className="text-xs text-muted-foreground tabular">{relativeDateTime(a.created_at)}</span>
                  <span className="text-sm">{a.message}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune activité.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
