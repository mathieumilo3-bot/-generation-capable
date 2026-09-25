import type { Metadata, Viewport } from "next";
import { Inter_Tight, Manrope } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import { Analytics, AnalyticsNoScript } from "@/components/Analytics";
import { ConsentBanner } from "@/components/ConsentBanner";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * `optional` rather than `swap`: the headline is huge, so a late font swap
 * re-wraps it and drags the whole page up (measured CLS 0.21 on a throttled
 * phone, over the 0.1 budget). Both faces are preloaded, so on a normal
 * connection they still arrive inside the block period and get used; on a
 * slow one the visitor keeps the metric-matched fallback for that view
 * instead of watching the page jump.
 */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "optional",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Digital Revenue Systems`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Digital Revenue Systems`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Digital Revenue Systems`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${interTight.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        <Analytics />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <AnalyticsNoScript />
        <MotionConfig reducedMotion="user">
          {/*
            The site chrome (navbar, footer, skip link, <main>) lives in each
            route group's layout: (gc) for Génération Capable itself, and the
            client demonstrations under /demonstrations, which must look like
            the client's own site, not like ours.
          */}
          {children}
          <ConsentBanner />
        </MotionConfig>
      </body>
    </html>
  );
}
