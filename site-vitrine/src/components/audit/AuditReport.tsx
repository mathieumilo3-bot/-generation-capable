"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";
import { buildCalendlyUrl } from "@/lib/booking";
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
    label: "02 — Convaincre",
    question: "Une fois arrivé, comprend-il immédiatement ce que vous faites et pourquoi il peut vous faire confiance ?",
    dimensions: ["positioning", "psychology", "offer", "trust", "social_proof", "price_value"],
    impact: "Réduire le doute avant la prise de contact.",
  },
  {
    id: "convertir",
    label: "03 — Faire agir",
    question: "Le visiteur sait-il immédiatement quoi faire ensuite : appeler, demander un devis ou réserver ?",
    dimensions: ["funnel", "conversion", "retention", "business_model"],
    impact: "Transformer l’intérêt en demande concrète sans friction inutile.",
  },
];

function pillarForFinding(finding: Finding): PillarId {
  return PILLARS.find((pillar) => pillar.dimensions.includes(finding.dimension))?.id ?? "rassurer";
}

function pillarState(report: Report, pillarId: PillarId) {
  const pillar = PILLARS.find((item) => item.id === pillarId)!;
  const leaks = report.topLeaks.filter((finding) => pillar.dimensions.includes(finding.dimension));
  const strengths = report.worksWell.filter((finding) => pillar.dimensions.includes(finding.dimension));

  if (leaks.length > 0) return { label: "À renforcer", tone: "text-[var(--color-accent)]" };
  if (strengths.length > 0) return { label: "Base présente", tone: "text-[var(--color-text)]" };
  return { label: "À approfondir", tone: "text-[var(--color-muted)]" };
}

const CONFIDENCE_LABEL = {
  observed: "Observé sur votre site",
  inferred: "Déduit",
  unknown: "À vérifier ensemble",
} as const;

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

  return (
    <div ref={ref} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-sm text-[var(--color-accent)]">{String(rank).padStart(2, "0")}</span>
        <div className="text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {pillar.label.replace(/^\d+ — /, "")}
          </span>
          <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
            {ai ? (ai.confidence === "observed" ? "Observé sur votre site" : "Déduit des éléments visibles") : finding ? CONFIDENCE_LABEL[finding.confidence] : "Analyse"}
          </span>
        </div>
      </div>
      <h3 className="font-display mt-4 text-xl font-semibold tracking-tight text-[var(--color-text)]">
        {ai?.title || finding?.title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
        {ai?.diagnosis || finding?.statement}
      </p>
      {ai?.evidence?.length ? (
        <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Preuves concrètes
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-relaxed text-[var(--color-text)]">
            {ai.evidence.map((item, index) => <li key={index}>• {item}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Pourquoi ça compte
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{ai?.impact || pillar.impact}</p>
      </div>
    </div>
  );
}

type AuditReportProps = {
  report: Report;
  lead?: { nom?: string; email?: string };
};

export function AuditReport({ report, lead }: AuditReportProps) {
  const viewedTracked = useRef(false);
  const bookingUrl = buildCalendlyUrl(lead);
  const priorities = report.topLeaks.slice(0, 3);
  const synthesis = report.aiSynthesis;
  const aiOpportunities = synthesis?.opportunities ?? [];

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
          Audit GC
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Ce qui bloque aujourd’hui</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          {synthesis?.executiveSummary ||
            "Nous suivons le parcours recherche → découverte → compréhension → confiance → action pour repérer les opportunités qui peuvent avoir une utilité commerciale."}
        </p>
        {synthesis?.companySnapshot && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Activité détectée</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text)]">{synthesis.companySnapshot}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.siteUrl}
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.secteur}
        </span>
      </div>

      {report.degraded && report.degradedReason && (
        <div className="mt-8 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-text)]">
            <span className="font-semibold">Analyse partielle.</span> {report.degradedReason}
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {PILLARS.map((pillar) => {
          const state = pillarState(report, pillar.id);
          return (
            <div key={pillar.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{pillar.label}</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                {pillar.id === "attirer"
                  ? synthesis?.attirer || pillar.question
                  : pillar.id === "rassurer"
                    ? synthesis?.rassurer || pillar.question
                    : synthesis?.convertir || pillar.question}
              </p>
              <p className={`mt-4 text-xs font-semibold ${state.tone}`}>
                {synthesis
                  ? aiOpportunities.some((item) => item.pillar === pillar.id)
                    ? "À renforcer"
                    : "Pas de friction majeure détectée"
                  : state.label}
              </p>
            </div>
          );
        })}
      </div>

      {synthesis?.webQueries?.length ? (
        <div className="mt-6 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Visibilité web · recherches testées
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text)]">
            Nous avons testé des recherches proches de celles qu’un prospect pourrait faire sans connaître votre nom.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {synthesis.webQueries.map((query) => (
              <span key={query} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-muted)]">
                {query}
              </span>
            ))}
          </div>
          {synthesis.webSources?.length ? (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Sources consultées</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {synthesis.webSources.slice(0, 4).map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-text)] underline decoration-[var(--color-border-strong)] underline-offset-4"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-muted)]">
            Ce signal vérifie la découvrabilité sur le web. Il ne prétend pas mesurer une position Google Maps exacte ni un classement personnalisé.
          </p>
        </div>
      ) : null}

      {(aiOpportunities.length > 0 || priorities.length > 0) && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            3 constats concrets
          </p>
          <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Voilà ce qui mérite votre attention en premier.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Chaque point ci-dessous part d’un élément réellement observé. On vous montre le constat et pourquoi il compte. Le plan de correction précis se construit pendant l’appel.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {aiOpportunities.length > 0
              ? aiOpportunities.map((item, index) => (
                  <OpportunityCard key={item.id} rank={index + 1} ai={item} />
                ))
              : priorities.map((finding, index) => (
                  <OpportunityCard key={finding.id} finding={finding} rank={index + 1} />
                ))}
          </div>
        </div>
      )}

      <div id="prochaine-etape" className="mt-8 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 text-center sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
          Prochaine étape
        </p>
        <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          On vous montre quoi corriger en premier.
        </h3>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
          {synthesis?.callBridge ||
            "Pendant 30 minutes, nous reprenons ces constats, choisissons les 3 corrections prioritaires et définissons l’ordre exact dans lequel les mettre en place."}
        </p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Vous repartez avec</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-text)]">
            <li>✓ les 3 corrections prioritaires</li>
            <li>✓ l’ordre exact dans lequel les traiter</li>
            <li>✓ les prochaines actions adaptées à votre activité</li>
          </ul>
        </div>
        <div className="mt-7">
          <Button
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            trackEvent="booking_started"
            trackPayload={{ location: "audit_report", source: "capable_audit" }}
            onClick={() => track("audit_cta_clicked", { location: "audit_report", intent: "book_strategy_call" })}
          >
            Réserver mon bilan de 30 min →
          </Button>
        </div>
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          30 minutes · Analyse · Plan d’action priorisé
        </p>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-[var(--color-muted)]">{report.sectorNote}</p>
    </motion.div>
  );
}
