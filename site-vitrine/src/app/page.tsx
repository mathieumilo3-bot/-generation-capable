import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { InstantCheck } from "@/components/sections/InstantCheck";
import { Recommendation } from "@/components/sections/Recommendation";
import { SystemDemo } from "@/components/sections/SystemDemo";
import { SystemArchitecture } from "@/components/sections/SystemArchitecture";
import { Systems } from "@/components/sections/Systems";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { LandingView } from "@/components/sections/LandingView";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "GC — Systèmes digitaux qui génèrent des opportunités",
  description:
    "Nous transformons votre visibilité, votre site et votre parcours commercial en un système qui génère davantage de demandes qualifiées.",
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
      <FAQ />
      <FinalCTA />
    </>
  );
}
