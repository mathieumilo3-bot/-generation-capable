"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/tracking";

/** Fires the landing_view event once per visit. Renders nothing. */
export function LandingView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("landing_view");
  }, []);

  return null;
}
