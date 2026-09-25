"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { CASE_STUDY_PATH, COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";

const NAV = [
  { label: "Réalisations", href: `${DEMO_BASE_PATH}/realisations` },
  { label: "Expertises", href: `${DEMO_BASE_PATH}/expertises` },
  { label: "Méthode", href: `${DEMO_BASE_PATH}#methode` },
  { label: "L'entreprise", href: `${DEMO_BASE_PATH}/entreprise` },
] as const;

const PROJECT_PATH = `${DEMO_BASE_PATH}/projet`;

/** Hash links go through a native anchor: the router does not own in-page scrolling. */
function NavLink(props: React.ComponentPropsWithoutRef<typeof Link> & { href: string }) {
  if (props.href.includes("#")) {
    const { href, prefetch, replace, scroll, shallow, ...rest } = props;
    void prefetch;
    void replace;
    void scroll;
    void shallow;
    return <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }
  return <Link {...props} />;
}
const MENU_ID = "cc-menu-mobile";

/**
 * The discreet demonstration ribbon. It keeps the demo honest (fictional
 * company, GC concept) without breaking immersion, and holds the switch that
 * reveals Génération Capable's strategic annotations section by section.
 */
export function DemoRibbon() {
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.ccNotes = notes ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.ccNotes;
    };
  }, [notes]);

  return (
    <div className="bg-[#0b0b0b] text-[12.5px] text-[#c9c5bc]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 sm:px-8 lg:px-12">
        <p>
          <span className="text-[#e9e6df]">Site de démonstration.</span>{" "}
          <span className="hidden sm:inline">Clos &amp; Cadre est une entreprise fictive — </span>
          <Link href={CASE_STUDY_PATH} className="underline decoration-[#e5b94a]/60 underline-offset-4 hover:text-white">
            concept stratégique et design Génération Capable
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setNotes((value) => !value)}
          aria-pressed={notes}
          className="inline-flex min-h-8 items-center gap-2 text-[#e9e6df] hover:text-white"
        >
          <span
            aria-hidden="true"
            className={`relative inline-block h-4 w-7 rounded-full transition-colors ${notes ? "bg-[#e5b94a]" : "bg-[#3a3a38]"}`}
          >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[#0b0b0b] transition-all ${notes ? "left-3.5" : "left-0.5"}`} />
          </span>
          Lire la stratégie
        </button>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <Link href={DEMO_BASE_PATH} className="group flex items-baseline gap-3" aria-label={`${COMPANY.name} — accueil`}>
      <span className="cc-serif text-[25px] leading-none tracking-[-0.02em]">
        Clos <span className="text-[var(--cc-accent)]">&amp;</span> Cadre
      </span>
      <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[var(--cc-muted)] xl:inline">Rénovation · Extension</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const current = (href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--cc-line)] bg-[var(--cc-bg)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] w-full max-w-[1320px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Wordmark />

        <nav aria-label="Navigation principale" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              aria-current={current(item.href) ? "page" : undefined}
              className={`text-[15px] transition-colors hover:text-[var(--cc-ink)] ${current(item.href) ? "text-[var(--cc-ink)]" : "text-[var(--cc-muted)]"}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <a href={COMPANY.phoneHref} className="text-[15px] tabular-nums text-[var(--cc-ink)] hover:text-[var(--cc-accent)]">
            {COMPANY.phoneDisplay}
          </a>
          <Link
            href={PROJECT_PATH}
            className="inline-flex min-h-11 items-center rounded-[2px] bg-[var(--cc-ink)] px-5 text-[14px] font-medium text-[var(--cc-bg)] transition-colors hover:bg-[var(--cc-accent)]"
          >
            Parler de votre projet
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true" className="relative block h-3 w-6">
            <span className={`absolute left-0 h-px w-6 bg-current transition-transform ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-6 bg-current transition-transform ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>

      {open && (
        <div id={MENU_ID} className="fixed inset-x-0 bottom-0 top-[68px] z-40 overflow-y-auto bg-[var(--cc-bg)] lg:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col px-5 pt-4 sm:px-8">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={current(item.href) ? "page" : undefined}
                className="cc-serif border-b border-[var(--cc-line)] py-5 text-[30px] leading-none"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex flex-col gap-3 px-5 py-8 sm:px-8">
            <Link href={PROJECT_PATH} onClick={() => setOpen(false)} className="flex min-h-14 items-center justify-center bg-[var(--cc-ink)] text-[16px] font-medium text-[var(--cc-bg)]">
              Décrire votre projet
            </Link>
            <a href={COMPANY.phoneHref} className="flex min-h-14 items-center justify-center border border-[var(--cc-line-strong)] text-[16px]">
              Appeler le {COMPANY.phoneDisplay}
            </a>
            <p className="mt-2 text-center text-[14px] text-[var(--cc-muted)]">{COMPANY.hours}</p>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Phone-only action bar: call and project request always one thumb away.
 * Hidden on the request page itself, where it would only compete with the form.
 */
export function MobileActionBar() {
  const pathname = usePathname();
  if (pathname === PROJECT_PATH) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[76px] lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--cc-line)] bg-[var(--cc-bg)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md gap-3">
          <a
            href={COMPANY.phoneHref}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 border border-[var(--cc-line-strong)] text-[15px] font-medium"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5.5 2.5h-2a1 1 0 0 0-1 1C2.5 11 9 17.5 16.5 17.5a1 1 0 0 0 1-1v-2l-3.5-1.5-1.5 1.5c-2-1-4-3-5-5L9 8 7.5 4.5z" />
            </svg>
            Appeler
          </a>
          <Link href={PROJECT_PATH} className="flex min-h-12 flex-[1.4] items-center justify-center bg-[var(--cc-ink)] text-[15px] font-medium text-[var(--cc-bg)]">
            Décrire mon projet
          </Link>
        </div>
      </div>
    </>
  );
}
