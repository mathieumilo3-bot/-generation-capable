"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS, PRIMARY_CTA_LABEL, SITE_NAME } from "@/lib/constants";

const MOBILE_MENU_ID = "menu-principal-mobile";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu and hands focus back to the control that opened it.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A route change from anywhere (link, back button) must not leave it open.
  // Adjusted during render rather than in an effect, so the menu never paints
  // open for a frame on the new page.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  function isCurrent(href: string) {
    if (href.includes("#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text)]"
        >
          {SITE_NAME}
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={`text-sm transition-colors duration-200 hover:text-[var(--color-text)] ${
                isCurrent(link.href)
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button
            href="/audit"
            variant="primary"
            className="px-6 py-3 text-[13px]"
            trackEvent="cta_clicked"
            trackPayload={{ location: "navbar" }}
          >
            {PRIMARY_CTA_LABEL}
          </Button>
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls={MOBILE_MENU_ID}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 lg:hidden"
        >
          <span
            className={`h-px w-5 bg-[var(--color-text)] transition-transform duration-300 ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
          />
          <span
            className={`h-px w-5 bg-[var(--color-text)] transition-transform duration-300 ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={MOBILE_MENU_ID}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-bg)] lg:hidden"
          >
            <nav aria-label="Navigation principale" className="flex flex-col gap-1 px-6 py-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="py-3 text-base text-[var(--color-text)]"
                >
                  {link.label}
                </Link>
              ))}
              <Button
                href="/audit"
                variant="primary"
                className="mt-4 w-full"
                onClick={() => setOpen(false)}
                trackEvent="cta_clicked"
                trackPayload={{ location: "navbar_mobile" }}
              >
                {PRIMARY_CTA_LABEL}
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
