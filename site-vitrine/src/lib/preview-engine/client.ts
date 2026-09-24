"use client";

import type { BookingAttribution } from "@/lib/booking";
import { track, type TrackingEvent } from "@/lib/tracking";

/**
 * Browser-side helpers of the V2 funnel. Attribution is read from the ad
 * click URL once and kept for the session, so every preview event — and the
 * booking link — carries source / medium / campaign / content / term. It is
 * sent to our server only when measurement was accepted.
 */

const ATTRIBUTION_KEY = "gc-preview-attribution-v1";
const HANDLE_KEY = "gc-preview-v2-handle";
const CONSENT_KEY = "gc-revenue-consent-v1";

export type StoredAttribution = BookingAttribution & { gclid?: string; gbraid?: string; wbraid?: string };
export type PreviewHandle = { id: string; token: string; companyName: string; startedAt: number };

export function captureAttribution(): StoredAttribution {
  const params = new URLSearchParams(window.location.search);
  const read = (key: string, max = 120) => params.get(key)?.trim().slice(0, max) || undefined;
  const fromUrl: StoredAttribution = {
    source: read("utm_source"),
    medium: read("utm_medium"),
    campaign: read("utm_campaign"),
    content: read("utm_content"),
    term: read("utm_term"),
    gclid: read("gclid", 220),
    gbraid: read("gbraid", 220),
    wbraid: read("wbraid", 220),
  };
  const hasUrl = Object.values(fromUrl).some(Boolean);
  try {
    if (hasUrl) sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(fromUrl));
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    return stored ? (JSON.parse(stored) as StoredAttribution) : fromUrl;
  } catch {
    return fromUrl;
  }
}

export function readAttribution(): StoredAttribution {
  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    return stored ? (JSON.parse(stored) as StoredAttribution) : {};
  } catch {
    return {};
  }
}

export function measurementGranted(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function trackPreview(event: TrackingEvent, payload: Record<string, string | number | boolean | undefined> = {}): void {
  const a = readAttribution();
  track(event, {
    flow: "preview_v2",
    source: a.source,
    medium: a.medium,
    campaign: a.campaign,
    content: a.content,
    term: a.term,
    ...payload,
  });
}

export function saveHandle(handle: PreviewHandle): void {
  try {
    localStorage.setItem(HANDLE_KEY, JSON.stringify(handle));
  } catch {}
}

export function readHandle(): PreviewHandle | null {
  try {
    const raw = localStorage.getItem(HANDLE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PreviewHandle) : null;
    return parsed && Date.now() - parsed.startedAt < 24 * 3_600_000 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearHandle(): void {
  try {
    localStorage.removeItem(HANDLE_KEY);
  } catch {}
}

export async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export function vitrineUrl(id: string, token: string): string {
  return `/audit/preview-v2/vitrine#id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`;
}
