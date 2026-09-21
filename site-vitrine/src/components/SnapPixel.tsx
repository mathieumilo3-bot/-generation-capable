"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SNAP_PIXEL_ID = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID;
const CONSENT_KEY = "gc-revenue-consent-v1";

declare global {
  interface Window {
    snaptr?: {
      (...args: unknown[]): void;
      queue?: unknown[];
      handleRequest?: (...args: unknown[]) => void;
    };
  }
}

function hasAdvertisingConsent() {
  return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

function ensureSnapPixel() {
  if (!SNAP_PIXEL_ID || !hasAdvertisingConsent()) return false;

  if (!window.snaptr) {
    const snaptr = function (...args: unknown[]) {
      const tracker = window.snaptr;
      if (tracker?.handleRequest) {
        tracker.handleRequest(...args);
        return;
      }
      tracker?.queue?.push(args);
    };

    snaptr.queue = [];
    window.snaptr = snaptr;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://sc-static.net/scevent.min.js";
    script.dataset.gcSnapPixel = "true";
    document.head.appendChild(script);

    window.snaptr("init", SNAP_PIXEL_ID);
  }

  return true;
}

export function SnapPixel() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!SNAP_PIXEL_ID) return;

    const trackCurrentPage = () => {
      if (!ensureSnapPixel()) return;
      if (lastTrackedPath.current === pathname) return;
      window.snaptr?.("track", "PAGE_VIEW");
      lastTrackedPath.current = pathname;
    };

    trackCurrentPage();
    window.addEventListener("gc:consent-updated", trackCurrentPage);

    return () => window.removeEventListener("gc:consent-updated", trackCurrentPage);
  }, [pathname]);

  return null;
}
