import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { AuditFunnel } from "./AuditFunnel";

export const metadata: Metadata = {
  title: "Analyser mon entreprise — Capable Audit",
  description:
    "Obtenez un diagnostic initial de votre présence digitale : visibilité, crédibilité, conversion et parcours client. Sans engagement.",
  alternates: { canonical: "/audit" },
};

export default function AuditPage() {
  return (
    <Section className="py-24 sm:py-32">
      <AuditFunnel />
    </Section>
  );
}
