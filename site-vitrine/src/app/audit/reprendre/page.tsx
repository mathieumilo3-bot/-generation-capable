import type { Metadata } from "next";
import { AuditResumeClient } from "./AuditResumeClient";

export const metadata: Metadata = {
  title: "Votre diagnostic GC",
  robots: { index: false, follow: false },
};

export default function AuditResumePage() {
  return (
    <main className="min-h-screen px-4 py-20 sm:py-28">
      <AuditResumeClient />
    </main>
  );
}
