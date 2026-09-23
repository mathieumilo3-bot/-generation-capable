"use client";

import { useEffect, useState } from "react";
import { AuditReport } from "@/components/audit/AuditReport";
import { Button } from "@/components/ui/Button";
import type { BookingAttribution } from "@/lib/booking";
import { trackGoogleAdsLeadConversion } from "@/lib/tracking";
import type { Report } from "@/lib/audit-engine/types";

type DiscoverySnapshot = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insights: { title: string; insight: string; evidence: string[] }[];
};

type StoredAudit = {
  report: Report | null;
  lead?: { nom?: string; email?: string; telephone?: string; adUserDataConsent?: string };
  entreprise?: string;
  discovery?: DiscoverySnapshot | null;
  attribution?: BookingAttribution;
};

export function AuditThankYouClient() {
  const [stored, setStored] = useState<StoredAudit | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gc_audit_result");
      const parsed = raw ? (JSON.parse(raw) as StoredAudit) : null;
      if (parsed) {
        // Session storage exists only after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(parsed);
      }

      if (sessionStorage.getItem("gc_google_ads_conversion_pending") === "1") {
        trackGoogleAdsLeadConversion(parsed?.lead);
        sessionStorage.removeItem("gc_google_ads_conversion_pending");
      }
    } catch {
      // Fallback below if browser storage is unavailable or malformed.
    } finally {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        discovery={stored.discovery}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
        Votre diagnostic est prêt.
      </h1>
      <div className="mx-auto mt-8 max-w-xl">
        <Button
          href="/audit/rendez-vous"
          variant="primary"
          className="audit-primary-cta min-h-16 w-full px-8 text-lg sm:text-xl"
          trackEvent="booking_started"
          trackPayload={{ location: "audit_thank_you", source: "capable_audit" }}
        >
          Construire mon plan d’action →
        </Button>
      </div>
    </div>
  );
}
