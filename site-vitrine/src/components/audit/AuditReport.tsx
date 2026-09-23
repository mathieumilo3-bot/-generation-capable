"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";
import { buildCalendlyUrl, type BookingAttribution } from "@/lib/booking";
import type { AiAuditOpportunity, Dimension, Finding, Report } from "@/lib/audit-engine/types";

type PillarId = "attirer" | "rassurer" | "convertir";

const PILLARS: {
  id: PillarId;
  label: string;
  question: string;
  dimensions: Dimension[];
  impact: string;
}[] = [
  {
    id: "attirer",
    label: "01 — Être trouvé",
    question: "Quand un prospect cherche votre métier, votre service ou votre zone, est-ce qu’il peut vous découvrir ?",
    dimensions: ["acquisition", "positioning"],
    impact: "Être visible au moment précis où un prospect cherche votre service.",
  },
  {
    id: "rassurer",
    label: "02 — Être choisi",
    question: "Une fois arrivé, comprend-il immédiatement pourquoi vous choisir plutôt qu’un autre ?",
    dimensions: ["positioning", "psychology", "offer", "trust", "social_proof", "price_value"],
    impact: "Renforcer la confiance avant la prise de contact.",
  },
  {
    id: "convertir",
    label: "03 — Être contacté",
    question: "Le visiteur sait-il immédiatement comment vous appeler ou vous demander un devis ?",
    dimensions: ["funnel", "conversion", "retention", "business_model"],
    impact: "Transformer l’intérêt en demande concrète avec un parcours fluide.",
  },
];

function pillarForFinding(finding: Finding): PillarId {
  return PILLARS.find((pillar) => pillar.dimensions.includes(finding.dimension))?.id ?? "rassurer";
}

function OpportunityCard({ finding, rank, ai }: { finding?: Finding; rank: number; ai?: AiAuditOpportunity }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const pillarId = ai?.pillar ?? (finding ? pillarForFinding(finding) : "rassurer");
  const pillar = PILLARS.find((item) => item.id === pillarId) ?? PILLARS[1];

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !seen.current) {
          seen.current = true;
          track("audit_finding_viewed", {
            finding_id: finding?.id ?? ai?.id ?? "ai_opportunity",
            dimension: finding?.dimension ?? ai?.pillar ?? "ai",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [finding?.id, finding?.dimension, ai?.id, ai?.pillar]);

  const title = ai?.title || finding?.title;
  const diagnosis = ai?.diagnosis || finding?.statement;
  const impact = ai?.impact || pillar.impact;
  const score = ai?.score;
  const evidence = ai?.evidence?.[0] || finding?.evidence?.[0];
  const loss =
    ai?.loss ||
    (finding?.polarity === "negative"
      ? "Ce point crée une friction dans le parcours entre intérêt et prise de contact."
      : "");
  const potential = ai?.potential;

  return (
    <div ref={ref} className="rounded-[1.6rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {String(rank).padStart(2, "0")} · {pillar.label.replace(/^\d+ — /, "")}
          </p>
          <h3 className="font-display mt-2 text-xl font-semibold tracking-tight text-[var(--color-text)]">
            {title}
          </h3>
        </div>

        {score ? (
          <div className="shrink-0 text-right">
            <div className="font-display text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-[var(--color-text)]">
              {score}<span className="ml-1 text-sm font-medium tracking-normal text-[var(--color-muted)]">/10</span>
            </div>
            <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--color-muted)]">qualité actuelle</p>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
        {diagnosis}
      </p>

      {evidence ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Vu :</span> {evidence}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Ce que vous perdez</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--color-text)]">
            {loss || "Une partie du potentiel commercial de ce point reste sous-exploitée."}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Potentiel</p>
            {potential ? (
              <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                {potential}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--color-text)]">{impact}</p>
        </div>
      </div>

      {ai?.firstAction ? (
        <div className="mt-3 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            À corriger
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--color-text)]">
            {ai.firstAction}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type AuditDiscovery = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insights: { title: string; insight: string; evidence: string[] }[];
};

type AuditReportProps = {
  report: Report;
  lead?: { nom?: string; email?: string };
  attribution?: BookingAttribution;
  discovery?: AuditDiscovery | null;
};

export function AuditReport({ report, lead, attribution, discovery }: AuditReportProps) {
  const viewedTracked = useRef(false);
  const bookingUrl = buildCalendlyUrl(lead, attribution);
  const synthesis = report.aiSynthesis;
  const discoveryOpportunities: AiAuditOpportunity[] = (discovery?.insights ?? []).slice(0, 3).map((item, index) => {
    const pillar: PillarId = index === 0 ? "attirer" : index === 1 ? "rassurer" : "convertir";
    return {
      id: `discovery_${index + 1}`,
      pillar,
      title: item.title,
      diagnosis: item.insight,
      evidence: item.evidence,
      confidence: "inferred",
      loss:
        pillar === "attirer"
          ? "Des prospects qui cherchent vos services sans connaître votre nom peuvent ne jamais arriver jusqu’à vous."
          : pillar === "rassurer"
            ? "Une partie des visiteurs peut hésiter au moment de vous comparer à une autre entreprise."
            : "Une partie de l’intérêt peut se perdre avant l’appel ou la demande de devis.",
      potential: pillar === "rassurer" ? "fort" : "très fort",
      impact:
        pillar === "attirer"
          ? "Être découvert plus souvent au moment où un prospect cherche déjà ce type de service."
          : pillar === "rassurer"
            ? "Donner plus vite les raisons de vous choisir et de vous faire confiance."
            : "Transformer plus clairement l’intérêt en demande exploitable.",
      firstAction:
        pillar === "attirer"
          ? "Clarifier une entrée dédiée au service principal et à la zone réellement desservie."
          : pillar === "rassurer"
            ? "Rapprocher une preuve réelle — réalisation, avis ou référence — du moment où le prospect doit décider."
            : "Rendre une seule action principale immédiatement visible : appeler ou demander un devis.",
      callQuestion:
        pillar === "attirer"
          ? "Quelles recherches et zones doivent devenir prioritaires ?"
          : pillar === "rassurer"
            ? "Quelles preuves doivent être mises en avant en premier ?"
            : "Quel parcours de contact doit être simplifié en priorité ?",
    };
  });
  const aiOpportunities = synthesis?.opportunities?.length
    ? [
        ...synthesis.opportunities,
        ...discoveryOpportunities.filter(
          (candidate) =>
            !synthesis.opportunities.some(
              (existing) => existing.title.trim().toLowerCase() === candidate.title.trim().toLowerCase()
            )
        ),
      ].slice(0, 3)
    : discoveryOpportunities;
  const hasUsefulResearch = aiOpportunities.length > 0;

  useEffect(() => {
    if (viewedTracked.current) return;
    viewedTracked.current = true;
    track("audit_report_viewed", {
      sector: report.header.sectorProfile,
      degraded: report.degraded,
      leak_count: report.topLeaks.length,
    });
  }, [report.degraded, report.header.sectorProfile, report.topLeaks.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-2xl"
    >
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-accent)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        </span>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
          Votre diagnostic
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Voilà ce qu’on a réellement trouvé.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          {synthesis?.executiveSummary ||
            "On a analysé votre présence comme le ferait un futur client : est-ce qu’il vous trouve, vous choisit et vous contacte facilement ?"}
        </p>
        {(synthesis?.companySnapshot || discovery?.summary) && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Activité détectée</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text)]">{synthesis?.companySnapshot || discovery?.summary}</p>
          </div>
        )}
        {synthesis?.worksWell && synthesis.worksWell !== "À confirmer pendant le bilan." ? (
          <div className="mx-auto mt-3 max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Ce qui fonctionne déjà</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{synthesis.worksWell}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.siteUrl || report.header.entreprise}
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.secteur}
        </span>
      </div>

      {report.degraded && report.degradedReason && !hasUsefulResearch && (
        <div className="mt-8 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-text)]">
            <span className="font-semibold">Analyse partielle.</span> {report.degradedReason}
          </p>
        </div>
      )}


      {hasUsefulResearch && (
        <div className="mt-10">
          {synthesis?.webQueries?.length || synthesis?.webSources?.length ? (
            <p className="mb-6 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Analyse croisée · {synthesis?.webQueries?.length ?? 0} recherches · {synthesis?.webSources?.length ?? 0} sources publiques
            </p>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            {aiOpportunities.length} constat{aiOpportunities.length > 1 ? "s" : ""} concret{aiOpportunities.length > 1 ? "s" : ""}
          </p>
          <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Les points qui vous font perdre le plus d’opportunités.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Trois constats. Une note. Ce qui vous coûte des opportunités, ce que vous pouvez récupérer et quoi corriger.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {aiOpportunities.map((item, index) => (
              <OpportunityCard key={item.id} rank={index + 1} ai={item} />
            ))}
          </div>

        </div>
      )}

      <div id="prochaine-etape" className="audit-result-glow mt-10 rounded-[2rem] border border-[var(--color-accent)]/30 bg-[var(--color-surface)] p-7 text-center sm:p-10">
        <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Votre diagnostic est prêt.
        </h3>
        <div className="mx-auto mt-7 max-w-xl">
          <Button
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            className="audit-primary-cta min-h-16 w-full px-8 text-lg sm:text-xl"
            trackEvent="booking_started"
            trackPayload={{ location: "audit_report", source: "capable_audit" }}
            onClick={() => track("audit_cta_clicked", { location: "audit_report", intent: "book_action_plan" })}
          >
            Construire mon plan d’action →
          </Button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-[var(--color-muted)]">{report.sectorNote}</p>
    </motion.div>
  );
}
