import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { AuditThankYouClient } from "./AuditThankYouClient";

export const metadata: Metadata = {
  title: "Audit reçu | GC Agence",
  description: "Confirmation de réception de votre demande d'audit GC Agence.",
  robots: { index: false, follow: false },
};

export default function AuditThankYouPage() {
  return (
    <div className="audit-experience">
      <Section className="py-16 sm:py-24 lg:py-28">
        <AuditThankYouClient />
      </Section>
    </div>
  );
}
