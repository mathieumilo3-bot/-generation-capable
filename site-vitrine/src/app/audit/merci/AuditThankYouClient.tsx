"use client";

import { useEffect, useState } from "react";
import { AuditReport } from "@/components/audit/AuditReport";
import { Button } from "@/components/ui/Button";
import { buildCalendlyUrl, type BookingAttribution } from "@/lib/booking";
import { trackGoogleAdsLeadConversion } from "@/lib/tracking";
import type { Report } from "@/lib/audit-engine/types";

type StoredAudit = {
  report: Report | null;
  lead?: { nom?: string; email?: string; telephone?: string; adUserDataConsent?: string };
  entreprise?: string;
  attribution?: BookingAttribution;
};

export function AuditThankYouClient() {
  const [stored, setStored] = useState<StoredAudit | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gc_audit_result");
      const parsed = raw ? (JSON.parse(raw) as StoredAudit) : null;
      if (parsed) setStored(parsed);

      if (sessionStorage.getItem("gc_google_ads_conversion_pending") === "1") {
        trackGoogleAdsLeadConversion(parsed?.lead);
        sessionStorage.removeItem("gc_google_ads_conversion_pending");
      }
    } catch {
      // Fallback below if browser storage is unavailable or malformed.
    } finally {
      setLoaded(true);
    }
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-[var(--color-muted)]">Finalisation de votre diagnostic…</p>
      </div>
    );
  }

  if (stored?.report) {
    return (
      <AuditReport
        report={stored.report}
        lead={stored.lead}
        attribution={stored.attribution}
      />
    );
  }

  const bookingUrl = buildCalendlyUrl(stored?.lead, stored?.attribution);

  return (
    <div className="mx-auto max-w-xl text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-accent)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
      </span>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">
        Demande reçue
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
        Votre audit est en préparation.
      </h1>
      <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--color-muted)]">
        Nous avons bien reçu les informations pour {stored?.entreprise || "votre entreprise"}.
        Vous pouvez déjà réserver un créneau pendant que nous préparons les priorités.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="primary"
          className="audit-primary-cta min-h-14 px-8 text-base"
          trackEvent="booking_started"
          trackPayload={{ location: "audit_thank_you", source: "capable_audit" }}
        >
          Construire mon plan avec GC →
        </Button>
        <Button href="/" variant="secondary">
          Retour à l’accueil
        </Button>
      </div>
      <p className="mt-5 text-xs text-[var(--color-muted)]">
        30 min · On part de votre audit · Sans engagement
      </p>
    </div>
  );
}
