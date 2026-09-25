import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./clos-et-cadre.css";
import { DemoRibbon, Header, MobileActionBar } from "@/components/demos/clos-et-cadre/Shell";
import { Footer } from "@/components/demos/clos-et-cadre/Footer";
import { COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";

const serif = Newsreader({
  variable: "--font-cc-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Instrument_Sans({
  variable: "--font-cc-sans",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Démonstration Génération Capable : le site d'une entreprise générale de rénovation de l'Ouest parisien, conçu pour transformer un savoir-faire de chantier en demandes de projets qualifiées.";

export const metadata: Metadata = {
  title: {
    default: `${COMPANY.name} — Rénovation globale, extensions et surélévations dans l'Ouest parisien`,
    template: `%s — ${COMPANY.name}`,
  },
  description,
  alternates: { canonical: DEMO_BASE_PATH },
  // A fictional company must never be indexed as a real local business.
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: `${COMPANY.name} — démonstration Génération Capable`,
    title: `${COMPANY.name} — démonstration Génération Capable`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${COMPANY.name} — démonstration Génération Capable`,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  colorScheme: "light",
};

export default function ClosEtCadreLayout({ children }: LayoutProps<"/demonstrations/clos-et-cadre">) {
  return (
    <div className={`${serif.variable} ${sans.variable} cc-root flex min-h-full flex-1 flex-col`}>
      <a
        href="#cc-contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-[var(--cc-ink)] focus:px-5 focus:py-3 focus:text-[var(--cc-bg)]"
      >
        Aller au contenu
      </a>
      <DemoRibbon />
      <Header />
      <main id="cc-contenu" className="flex-1">
        {children}
      </main>
      <Footer />
      <MobileActionBar />
    </div>
  );
}
