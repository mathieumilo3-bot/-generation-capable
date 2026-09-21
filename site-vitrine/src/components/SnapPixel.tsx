"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SNAP_PIXEL_ID = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID;
const CONSENT_KEY = "gc-revenue-consent-v1";

type SnapTracker = ((...args: unknown[]) => void) & {
  queue: unknown[][];
  handleRequest?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    snaptr?: SnapTracker;
  }
}

function hasAdvertisingConsent() {
  return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

function ensureSnapPixel() {
  if (!SNAP_PIXEL_ID || !hasAdvertisingConsent()) return false;

  if (!window.snaptr) {
    const snaptr = ((...args: unknown[]) => {
      if (snaptr.handleRequest) {
        snaptr.handleRequest(...args);
        return;
      }
      snaptr.queue.push(args);
    }) as SnapTracker;

    snaptr.queue = [];
    window.snaptr = snaptr;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://sc-static.net/scevent.min.js";
    script.dataset.gcSnapPixel = "true";
    document.head.appendChild(script);

    snaptr("init", SNAP_PIXEL_ID);
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
