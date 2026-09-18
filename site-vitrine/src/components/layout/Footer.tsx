import Link from "next/link";
import { FOOTER_LINKS, LEGAL_LINKS, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-6 py-16 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-[0.2em] text-[var(--color-text)]">
              {SITE_NAME}
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{SITE_TAGLINE}.</p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-3 sm:flex sm:flex-wrap sm:gap-8">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-[var(--color-border)] pt-8 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.</p>
          <div className="flex gap-6">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--color-text)]">
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("gc:open-consent"))}
              className="hover:text-[var(--color-text)]"
            >
              Gérer mes cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
