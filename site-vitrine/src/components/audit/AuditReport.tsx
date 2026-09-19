"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";
import { buildCalendlyUrl } from "@/lib/booking";
import type { Dimension, Finding, Report } from "@/lib/audit-engine/types";

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
    label: "01 — Attirer",
    question: "Être trouvé par des prospects qui ne connaissent pas encore l’entreprise.",
    dimensions: ["acquisition", "positioning"],
    impact: "Créer davantage d’occasions d’être découvert au bon moment.",
  },
  {
    id: "rassurer",
    label: "02 — Rassurer",
    question: "Faire comprendre l’offre rapidement et donner les preuves nécessaires pour avancer.",
    dimensions: ["positioning", "psychology", "offer", "trust", "social_proof", "price_value"],
    impact: "Réduire l’hésitation et rendre la décision plus simple.",
  },
  {
    id: "convertir",
    label: "03 — Convertir",
    question: "Rendre la prochaine action évidente : contacter, demander un devis ou réserver.",
    dimensions: ["funnel", "conversion", "retention", "business_model"],
    impact: "Transformer plus facilement l’intérêt en demande concrète.",
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

function OpportunityCard({ finding, rank }: { finding: Finding; rank: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const pillar = PILLARS.find((item) => item.id === pillarForFinding(finding)) ?? PILLARS[1];

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !seen.current) {
          seen.current = true;
          track("audit_finding_viewed", { finding_id: finding.id, dimension: finding.dimension });
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [finding.id, finding.dimension]);

  return (
    <div ref={ref} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-sm text-[var(--color-accent)]">{String(rank).padStart(2, "0")}</span>
        <div className="text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {pillar.label.replace(/^\d+ — /, "")}
          </span>
          <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
            {CONFIDENCE_LABEL[finding.confidence]}
          </span>
        </div>
      </div>
      <h3 className="font-display mt-4 text-xl font-semibold tracking-tight text-[var(--color-text)]">
        {finding.title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">{finding.statement}</p>
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Impact recherché
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{pillar.impact}</p>
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
          Bilan GC
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Votre diagnostic</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Nous suivons le parcours recherche → découverte → compréhension → confiance → action pour repérer
          les opportunités qui peuvent avoir une utilité commerciale.
        </p>
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
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{pillar.question}</p>
              <p className={`mt-4 text-xs font-semibold ${state.tone}`}>{state.label}</p>
            </div>
          );
        })}
      </div>

      {priorities.length > 0 && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            Les opportunités prioritaires
          </p>
          <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Voici où nous voyons le plus de potentiel.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Nous vous montrons volontairement les points à travailler et leur impact. Le plan précis, l’ordre
            d’exécution et les choix à faire se construisent pendant le bilan stratégique.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {priorities.map((finding, index) => (
              <OpportunityCard key={finding.id} finding={finding} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {report.worksWell.length > 0 && (
        <div className="mt-10 rounded-2xl border border-[var(--color-border)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text)]">
            Une base à conserver
          </p>
          <p className="mt-3 text-sm font-medium text-[var(--color-text)]">{report.worksWell[0].title}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Le but n’est pas de tout refaire : on conserve ce qui fonctionne et on corrige d’abord ce qui bloque le plus.
          </p>
        </div>
      )}

      <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)]">
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            Exemple d’impact
          </p>
          <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Moins de choix. Plus de clarté. Une action évidente.
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--color-muted)]">Avant</p>
              <p className="mt-1 text-sm font-medium">3 boutons concurrents</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)]">Correction</p>
              <p className="mt-1 text-sm font-medium">1 action principale</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)]">Impact recherché</p>
              <p className="mt-1 text-sm font-medium">Une décision plus simple pour le visiteur</p>
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
            Exemple illustratif : ce n’est pas une promesse chiffrée ni un résultat client annoncé.
          </p>
        </div>
      </div>

      <div id="prochaine-etape" className="mt-8 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 text-center sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
          Votre bilan stratégique
        </p>
        <h3 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          On transforme ces constats en plan d’action priorisé.
        </h3>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
          Pendant 30 minutes, nous reprenons votre analyse, choisissons les 3 actions à traiter en premier et
          définissons les prochaines étapes adaptées à votre entreprise.
        </p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Vous repartez avec</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-text)]">
            <li>✓ vos 3 priorités expliquées</li>
            <li>✓ l’ordre dans lequel les traiter</li>
            <li>✓ un plan d’action concret pour la suite</li>
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
