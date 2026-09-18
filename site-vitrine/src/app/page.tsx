import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { ValueStrip } from "@/components/sections/ValueStrip";
import { Problem } from "@/components/sections/Problem";
import { SystemDemo } from "@/components/sections/SystemDemo";
import { SystemArchitecture } from "@/components/sections/SystemArchitecture";
import { AuditDemo } from "@/components/sections/AuditDemo";
import { Method } from "@/components/sections/Method";
import { Objections } from "@/components/sections/Objections";
import { SectorsPreview } from "@/components/sections/SectorsPreview";
import { CaseStudiesPreview } from "@/components/sections/CaseStudiesPreview";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ServiceJsonLd } from "@/components/schema/JsonLd";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Digital Revenue Systems",
  description: SITE_DESCRIPTION,
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
      <Hero />
      <ValueStrip />
      <Problem />
      <SystemDemo />
      <SystemArchitecture />
      <AuditDemo />
      <Method />
      <Objections />
      <SectorsPreview />
      <CaseStudiesPreview />
      <FAQ />
      <FinalCTA />
    </>
  );
}
