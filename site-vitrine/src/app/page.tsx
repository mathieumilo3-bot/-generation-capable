import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { ValueStrip } from "@/components/sections/ValueStrip";
import { InstantCheck } from "@/components/sections/InstantCheck";
import { Recommendation } from "@/components/sections/Recommendation";
import { SystemDemo } from "@/components/sections/SystemDemo";
import { SystemArchitecture } from "@/components/sections/SystemArchitecture";
import { Method } from "@/components/sections/Method";
import { Systems } from "@/components/sections/Systems";
import { Applications } from "@/components/sections/Applications";
import { Objections } from "@/components/sections/Objections";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { LandingView } from "@/components/sections/LandingView";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Digital Revenue Systems",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * The homepage is a single argument, in order: here is the promise, here is
 * what your presence produces, here is what we would change, here is the
 * system behind it, here is what it looks like for you, here are the
 * objections answered, here is the next step.
 *
 * Nothing before the diagnostic asks the visitor for anything — the value
 * comes first, the contact details only in /audit.
 */
export default function Home() {
  return (
    <>
      <ServiceJsonLd
        name="Systèmes digitaux de génération d'opportunités commerciales"
        description={SITE_DESCRIPTION}
        url={SITE_URL}
      />
      <LandingView />

      <Hero />
      <ValueStrip />
      <InstantCheck />
      <Recommendation />
      <SystemDemo />
      <SystemArchitecture />
      <Method />
      <Systems />
      <Applications />
      <Objections />
      <FAQ />
      <FinalCTA />
    </>
  );
}
