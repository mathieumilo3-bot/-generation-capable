import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { BeforeAfterShowcase } from "@/components/sections/BeforeAfterShowcase";
import { FAQ } from "@/components/sections/FAQ";
import { SimpleServices } from "@/components/sections/SimpleServices";
import { SimpleProcess } from "@/components/sections/SimpleProcess";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { LandingView } from "@/components/sections/LandingView";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "GC Agence | Site, visibilité & acquisition",
  description:
    "GC construit des sites clairs, améliore la visibilité et simplifie le parcours qui transforme un visiteur en demande, rendez-vous ou client.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <ServiceJsonLd
        name="Création de site, visibilité et acquisition"
        description={SITE_DESCRIPTION}
        url={SITE_URL}
      />
      <LandingView />

      <Hero />
      <SimpleServices />
      <SimpleProcess />
      <BeforeAfterShowcase />
      <FAQ />
      <FinalCTA />
    </>
  );
}
