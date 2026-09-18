"use client";

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("gc:open-consent"))}
      className="hover:text-[var(--color-text)]"
    >
      Gérer mes cookies
    </button>
  );
}
