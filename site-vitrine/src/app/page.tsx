import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { InstantCheck } from "@/components/sections/InstantCheck";
import { Recommendation } from "@/components/sections/Recommendation";
import { SystemDemo } from "@/components/sections/SystemDemo";
import { SystemArchitecture } from "@/components/sections/SystemArchitecture";
import { Systems } from "@/components/sections/Systems";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { SeoEntryPoints } from "@/components/sections/SeoEntryPoints";
import { LandingView } from "@/components/sections/LandingView";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "GC Agence | Création de site, SEO & marketing digital",
  description:
    "GC accompagne artisans, TPE et PME sur la création de site, le marketing digital, le SEO, Google Ads, Meta Ads, l'acquisition et la conversion pour générer des demandes qualifiées.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <ServiceJsonLd
        name="Systèmes digitaux de génération d'opportunités commerciales"
        description={SITE_DESCRIPTION}
        url={SITE_URL}
      />
      <LandingView />

      {/* The homepage now follows one commercial argument:
          promise → proof of thinking → diagnostic → mechanism → architecture → offer → objections → action. */}
      <Hero />
      <Recommendation />
      <InstantCheck />
      <SystemDemo />
      <SystemArchitecture />
      <Systems />
      <SeoEntryPoints />
      <FAQ />
      <FinalCTA />
    </>
  );
}
