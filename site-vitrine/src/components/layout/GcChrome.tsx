import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/**
 * Génération Capable's own shell: skip link, navbar, <main>, footer.
 * Used by the (gc) route group and by the root not-found page, which renders
 * outside any group and would otherwise lose the navigation.
 */
export function GcChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-[60] focus:rounded-full focus:bg-[var(--color-text)] focus:px-6 focus:py-3 focus:text-sm focus:font-medium focus:text-[var(--color-bg)]"
      >
        Aller au contenu principal
      </a>
      <Navbar />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
