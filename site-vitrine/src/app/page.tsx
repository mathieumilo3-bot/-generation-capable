import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { InstantCheck } from "@/components/sections/InstantCheck";
import { BeforeAfterShowcase } from "@/components/sections/BeforeAfterShowcase";
import { SystemArchitecture } from "@/components/sections/SystemArchitecture";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { LandingView } from "@/components/sections/LandingView";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "GC Agence | Acquisition digitale pour artisans & BTP",
  description:
    "GC accompagne les artisans et entreprises du BTP sur le site, Google, le SEO local et l’acquisition pour générer davantage de demandes de devis qualifiées.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <ServiceJsonLd
        name="Acquisition digitale pour artisans et entreprises du BTP"
        description={SITE_DESCRIPTION}
        url={SITE_URL}
      />
      <LandingView />

      <Hero />
      <BeforeAfterShowcase />
      <InstantCheck />
      <SystemArchitecture />
      <FAQ />
      <FinalCTA />
    </>
  );
}
