"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";
import { DIMENSION_LABELS } from "@/lib/audit-engine/types";
import type { Confidence, Finding, Report } from "@/lib/audit-engine/types";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  observed: "Observé sur votre site",
  inferred: "Déduit",
  unknown: "Non vérifiable automatiquement",
};

const CONFIDENCE_DOT: Record<Confidence, string> = {
  observed: "bg-[var(--color-accent)]",
  inferred: "border border-[var(--color-accent)]",
  unknown: "border border-[var(--color-muted)]",
};

/** Fires audit_finding_viewed once, the first time this finding actually scrolls into view. */
function FindingCard({ finding, rank }: { finding: Finding; rank?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <span className="font-display text-sm text-[var(--color-accent)]">
              {String(rank).padStart(2, "0")}
            </span>
          )}
          <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--color-text)]">
            {finding.title}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[finding.confidence]}`} />
          {CONFIDENCE_LABEL[finding.confidence]}
        </span>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">{finding.statement}</p>

      {finding.evidence.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {finding.evidence.map((item) => (
            <li key={item} className="flex gap-2 text-xs text-[var(--color-muted)]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-border-strong)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {finding.recommendation && (
        <p className="mt-4 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-text)]">
          <span className="font-semibold">Recommandation.</span> {finding.recommendation}
        </p>
      )}

      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
        {DIMENSION_LABELS[finding.dimension]}
      </p>
    </div>
  );
}

export function AuditReport({ report }: { report: Report }) {
  const viewedTracked = useRef(false);

  useEffect(() => {
    if (viewedTracked.current) return;
    viewedTracked.current = true;
    track("audit_report_viewed", {
      sector: report.header.sectorProfile,
      degraded: report.degraded,
      leak_count: report.topLeaks.length,
    });
  }, [report.degraded, report.header.sectorProfile, report.topLeaks.length]);

  async function handleShare() {
    track("audit_report_share_clicked");
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard access can be denied by the browser — the click is still
      // tracked, and there is nothing useful to show the visitor beyond
      // that failing silently rather than throwing an unhandled error.
    }
  }

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
        <h2 className="font-display mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          Votre diagnostic
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Nous avons analysé votre présence digitale et votre parcours commercial.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.siteUrl}
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
          {report.header.secteur}
        </span>
        {report.header.objectif && (
          <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)]">
            {report.header.objectif}
          </span>
        )}
      </div>

      {report.degraded && report.degradedReason && (
        <div className="mt-8 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-text)]">
            <span className="font-semibold">Analyse partielle.</span> {report.degradedReason}
          </p>
        </div>
      )}

      {report.topLeaks.length > 0 && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            {report.topLeaks.length > 1 ? "Les principales fuites" : "La principale fuite identifiée"}
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {report.topLeaks.map((finding, index) => (
              <FindingCard key={finding.id} finding={finding} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {report.worksWell.length > 0 && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
            Ce qui fonctionne
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {report.worksWell.map((finding) => (
              <li
                key={finding.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] px-5 py-4"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)] text-[10px] text-[var(--color-accent)]">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{finding.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{finding.statement}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.actionPlan.length > 0 && (
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text)]">
            Ce que nous changerions
          </p>
          <ol className="mt-5 flex flex-col gap-4">
            {report.actionPlan.map((step) => (
              <li key={step.order} className="flex gap-4">
                <span className="font-display shrink-0 text-lg font-semibold text-[var(--color-accent)]">
                  {String(step.order).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{step.recommendation}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-10 text-xs leading-relaxed text-[var(--color-muted)]">{report.sectorNote}</p>

      <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--color-border)] pt-10 sm:flex-row sm:justify-center">
        <Button href="/#systemes" variant="primary" trackEvent="audit_cta_clicked" trackPayload={{ location: "audit_report" }}>
          Voir comment nous corrigeons ces points →
        </Button>
        <button
          type="button"
          onClick={handleShare}
          className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Copier le lien
        </button>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-[var(--color-muted)]">
        Nous revenons vers vous par email avec le détail de ce diagnostic et les prochaines étapes.
      </p>
    </motion.div>
  );
}
