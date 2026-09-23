"use client";

import { useEffect, useRef, useState } from "react";
import { buildCalendlyUrl, CALENDLY_URL, type BookingAttribution } from "@/lib/booking";
import { track, trackGoogleAdsLeadConversion } from "@/lib/tracking";

type StoredAudit = {
  lead?: { nom?: string; email?: string; telephone?: string; adUserDataConsent?: string };
  attribution?: BookingAttribution;
  entreprise?: string;
};

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: { url: string; parentElement: HTMLElement; resize?: boolean }) => void;
    };
  }
}

export function BookingClient() {
  const hostRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const [bookingUrl, setBookingUrl] = useState(CALENDLY_URL);
  const [company, setCompany] = useState("");

  useEffect(() => {
    let stored: StoredAudit | null = null;
    try {
      const raw = sessionStorage.getItem("gc_audit_result");
      stored = raw ? (JSON.parse(raw) as StoredAudit) : null;
      // Session storage exists only after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookingUrl(buildCalendlyUrl(stored?.lead, stored?.attribution));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompany(stored?.entreprise || "");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookingUrl(buildCalendlyUrl());
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://calendly.com") return;
      const data = event.data as { event?: string } | null;
      if (data?.event !== "calendly.event_scheduled" || completedRef.current) return;
      completedRef.current = true;
      track("booking_completed", {
        source: stored?.attribution?.source || "capable_audit",
        company: stored?.entreprise || "unknown",
      });
      track("generate_lead", {
        source: stored?.attribution?.source || "capable_audit",
        stage: "booking_completed",
      });
      trackGoogleAdsLeadConversion(stored?.lead);
      try {
        sessionStorage.setItem("gc_booking_completed", "1");
      } catch {}
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const parentElement = hostRef.current;
    if (!parentElement) return;

    const init = () => {
      if (!window.Calendly || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      window.Calendly.initInlineWidget({
        url: bookingUrl,
        parentElement: hostRef.current,
        resize: true,
      });
    };

    if (window.Calendly) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      return () => existing.removeEventListener("load", init);
    }

    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.addEventListener("load", init, { once: true });
    document.body.appendChild(script);

    return () => script.removeEventListener("load", init);
  }, [bookingUrl]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--color-accent)]">
          Dernière étape
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          Construisons votre plan d’action.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          {company
            ? `Choisissez votre créneau pour ${company}. Le diagnostic reste la base de l’échange.`
            : "Choisissez votre créneau. Le diagnostic reste la base de l’échange."}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-white">
        <div ref={hostRef} className="min-h-[760px] w-full" />
      </div>
    </div>
  );
}
