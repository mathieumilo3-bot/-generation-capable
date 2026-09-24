import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { previewMode } from "@/lib/preview-engine/version";
import { PreviewFunnel } from "./PreviewFunnel";

/**
 * GC Preview Engine V2 — isolated entry point. Not linked from any public
 * page, not in the sitemap, never indexed. `/audit` (ad traffic) is untouched.
 */
export const metadata: Metadata = {
  title: "Votre nouvelle vitrine",
  description: "Une proposition de site construite pour votre entreprise.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
};

export default async function PreviewV2Page() {
  // The feature flag is read per request, never frozen at build time.
  await connection();
  if (previewMode() === "off") notFound();
  return (
    <main className="audit-experience flex min-h-[78vh] items-center px-4 pb-24 pt-28 sm:pt-36">
      <PreviewFunnel />
    </main>
  );
}
