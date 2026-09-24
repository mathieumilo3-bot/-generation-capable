import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { previewMode } from "@/lib/preview-engine/version";
import { PreviewResult } from "./PreviewResult";

export const metadata: Metadata = {
  title: "Votre nouvelle vitrine",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
};

export default async function PreviewVitrinePage() {
  // The feature flag is read per request, never frozen at build time.
  await connection();
  if (previewMode() === "off") notFound();
  return (
    <main className="px-0 pb-20 pt-24 sm:pt-28">
      <PreviewResult />
    </main>
  );
}
