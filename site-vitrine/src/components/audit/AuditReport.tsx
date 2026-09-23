"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";
import { buildCalendlyUrl, type BookingAttribution } from "@/lib/booking";
import type { AiAuditOpportunity, Report } from "@/lib/audit-engine/types";
import type { DiagnosticCard } from "@/lib/audit-engine/facts";

const AXIS_LABELS: Record<DiagnosticCard["axis"], string> = {
  trouve: "Être trouvé",
  choisi: "Être choisi",
  contacte: "Être contacté",
};

const PILLAR_TO_AXIS: Record<AiAuditOpportunity["pillar"], DiagnosticCard["axis"]> = {
  attirer: "trouve",
  rassurer: "choisi",
  convertir: "contacte",
};

/** Reports stored by engine 1.x (older sessions) still render in the new format. */
function legacyCards(report: Report): DiagnosticCard[] {
  return (report.aiSynthesis?.opportunities ?? [])
    .filter((o) => o.score && o.loss && o.firstAction && o.potential)
    .slice(0, 3)
    .map((o) => ({
      id: o.id,
      axis: PILLAR_TO_AXIS[o.pillar],
      title: o.title,
      score: o.score!,
      finding: o.diagnosis,
      seen: o.evidence[0] ?? "",
      loss: o.loss!,
      potential: o.potential!,
      potentialText: o.impact,
      fix: o.firstAction!,
      basis: "site",
    }));
}

function DiagnosticCardView({ card, rank }: { card: DiagnosticCard; rank: number }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !seen.current) {
          seen.current = true;
          track("audit_finding_viewed", { finding_id: card.id, dimension: card.axis });
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [card.id, card.axis]);

  return (
    <article
      ref={ref}
      data-testid="diagnostic-card"
      className="rounded-[1.6rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 sm:p-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {String(rank).padStart(2, "0")} · {AXIS_LABELS[card.axis]}
      </p>

      <div className="mt-2 flex items-start justify-between gap-4">
        <h3 className="font-display min-w-0 text-[1.2rem] font-semibold leading-snug tracking-tight text-[var(--color-text)] sm:text-xl">
          {card.title}
        </h3>
        <p className="shrink-0 font-display text-[2rem] font-semibold leading-none tracking-[-0.05em] text-[var(--color-text)]">
          {card.score}
          <span className="ml-0.5 text-sm font-medium tracking-normal text-[var(--color-muted)]">/10</span>
        </p>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text)]">{card.finding}</p>

      {card.seen ? (
        <p className="mt-3 border-l-2 border-[var(--color-border-strong)] pl-3 text-[13px] leading-relaxed text-[var(--color-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Vu : </span>
          {card.seen}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Ce que vous perdez</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text)]">{card.loss}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Potentiel :{" "}
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2 py-0.5 text-[var(--color-accent)]">
              {card.potential}
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">{card.potentialText}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">À corriger</p>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-[var(--color-text)]">{card.fix}</p>
      </div>
    </article>
  );
}

type AuditReportProps = {
  report: Report;
  lead?: { nom?: string; email?: string };
  attribution?: BookingAttribution;
  /** Kept for stored sessions; the company line now comes from the report. */
  discovery?: { name?: string; city?: string } | null;
};

export function AuditReport({ report, lead, attribution, discovery }: AuditReportProps) {
  const viewedTracked = useRef(false);
  const bookingUrl = buildCalendlyUrl(lead, attribution);
  const diagnostic = report.diagnostic;
  const cards = (diagnostic?.cards ?? legacyCards(report)).slice(0, 3);
  const companyName = diagnostic?.company.name || report.header.entreprise || discovery?.name || "";
  const summary = diagnostic?.summary || "";

  useEffect(() => {
    if (viewedTracked.current) return;
    viewedTracked.current = true;
    track("audit_report_viewed", {
      sector: report.header.sectorProfile,
      degraded: report.degraded,
      leak_count: cards.length,
      mode: diagnostic?.mode ?? "legacy",
    });
  }, [report.degraded, report.header.sectorProfile, cards.length, diagnostic?.mode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-2xl"
    >
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Votre diagnostic</p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{companyName}</h2>
        {summary ? <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">{summary}</p> : null}
      </header>

      {cards.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {cards.map((card, index) => (
            <DiagnosticCardView key={card.id} card={card} rank={index + 1} />
          ))}
          <p className="px-2 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            Notes indicatives établies à partir des pages et sources publiques consultées — ce ne sont ni des mesures Google, ni des
            estimations de chiffre d’affaires.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-[1.6rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center">
          <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
            Nous n’avons pas retrouvé assez d’éléments publics fiables pour écrire des constats précis sans inventer.
          </p>
        </div>
      )}

      <div id="prochaine-etape" className="audit-result-glow mt-10 rounded-[2rem] border border-[var(--color-accent)]/30 bg-[var(--color-surface)] p-7 text-center sm:p-10">
        <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Votre diagnostic est prêt.</h3>
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
    </motion.div>
  );
}
