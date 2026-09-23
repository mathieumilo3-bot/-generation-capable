import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { BookingClient } from "./BookingClient";

export const metadata: Metadata = {
  title: "Construire mon plan d’action | GC Agence",
  description: "Choisissez votre créneau pour construire votre plan d’action à partir du diagnostic GC.",
  robots: { index: false, follow: false },
};

export default function AuditBookingPage() {
  return (
    <div className="audit-experience">
      <Section className="py-12 sm:py-16 lg:py-20">
        <BookingClient />
      </Section>
    </div>
  );
}
