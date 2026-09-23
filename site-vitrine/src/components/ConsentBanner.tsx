"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

const CONSENT_KEY = "gc-revenue-consent-v1";

type Choice = "accepted" | "refused";

/**
 * Whether the banner is open lives here, not solely inferred from
 * localStorage. A version that derives visibility purely from
 * `localStorage.getItem(key) === null` can never be reopened once a choice
 * exists — exactly the case "Gérer mes cookies" (CookieSettingsButton) needs
 * to work, and CNIL requires withdrawing consent to be as easy as giving it.
 */
let open: boolean | null = null; // null until first read — lazy so this stays SSR-safe.
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (open === null) {
    open = typeof window !== "undefined" && window.localStorage.getItem(CONSENT_KEY) === null;
  }
  return open;
}

function setOpen(next: boolean) {
  open = next;
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function updateConsent(choice: Choice) {
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.("consent", "update", {
    ad_storage: choice === "accepted" ? "granted" : "denied",
    ad_user_data: choice === "accepted" ? "granted" : "denied",
    ad_personalization: choice === "accepted" ? "granted" : "denied",
    analytics_storage: choice === "accepted" ? "granted" : "denied",
  });
  window.localStorage.setItem(CONSENT_KEY, choice);
  window.dispatchEvent(new CustomEvent("gc:consent-changed", { detail: { choice } }));
}

export function ConsentBanner() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);

  useEffect(() => {
    const storedChoice = window.localStorage.getItem(CONSENT_KEY);
    if (storedChoice === "accepted" || storedChoice === "refused") {
      updateConsent(storedChoice);
    }

    const reopen = () => setOpen(true);
    window.addEventListener("gc:open-consent", reopen);
    return () => window.removeEventListener("gc:open-consent", reopen);
  }, []);

  if (!visible) return null;

  function choose(choice: Choice) {
    updateConsent(choice);
    setOpen(false);
  }

  return (
    <aside
      role="dialog"
      aria-label="Préférences de confidentialité"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-3xl rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:left-auto"
    >
      <p className="font-display text-base font-semibold text-[var(--color-text)]">
        Votre confidentialité compte.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
        Nous utilisons des technologies de mesure d&apos;audience et, si vous
        l&apos;acceptez, de publicité pour comprendre les performances du site.
        Vous pouvez accepter ou refuser. Votre choix peut être modifié ultérieurement via « Gérer mes cookies » dans le pied de page.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-text)] px-5 text-sm font-medium text-[var(--color-bg)] transition-colors hover:bg-[var(--color-accent)]"
        >
          Accepter
        </button>
        <button
          type="button"
          onClick={() => choose("refused")}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border-strong)] px-5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
        >
          Refuser
        </button>
        <Link
          href="/politique-de-confidentialite"
          className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-text)] hover:underline"
        >
          En savoir plus
        </Link>
      </div>
    </aside>
  );
}
