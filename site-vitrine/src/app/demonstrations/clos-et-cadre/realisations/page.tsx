import type { Metadata } from "next";
import { ProjectCard } from "@/components/demos/clos-et-cadre/ProjectCard";
import { ProjectFilters } from "@/components/demos/clos-et-cadre/ProjectFilters";
import { FinalCta } from "@/components/demos/clos-et-cadre/sections";
import { Container, SectionHeading, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { PROJECTS } from "@/lib/demos/clos-et-cadre/projects";
import { SERVICES } from "@/lib/demos/clos-et-cadre/services";

export const metadata: Metadata = {
  title: "Réalisations",
  description: "Extensions, surélévations, rénovations globales et restructurations dans les Yvelines et les Hauts-de-Seine, documentées chantier par chantier.",
  alternates: { canonical: `${DEMO_BASE_PATH}/realisations` },
};

export default function RealisationsPage() {
  const options = SERVICES.map((service) => ({
    id: service.id,
    label: service.name,
    count: PROJECTS.filter((project) => project.service === service.id).length,
  })).filter((option) => option.count > 0);

  return (
    <>
      <section className="pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Container>
          <SectionHeading
            as="h1"
            kicker="Réalisations"
            title="Chaque chantier, avec sa contrainte, sa solution et son enveloppe."
            intro="Trouvez le projet le plus proche du vôtre : le type de bâti, la commune, la surface, la durée et le budget sont indiqués pour chacun."
          />
          <StrategyNote title="Filtrer par situation" className="mt-8 max-w-3xl">
            Le filtre suit les expertises, pas les pièces de la maison : un prospect se définit par son projet (« agrandir »,
            « surélever »), et c&apos;est ce qui le relie ensuite à la bonne page de service et au formulaire pré-rempli.
          </StrategyNote>
          <div className="mt-12">
            <ProjectFilters
              options={options}
              items={PROJECTS.map((project) => ({
                key: project.slug,
                service: project.service,
                node: <ProjectCard project={project} />,
              }))}
            />
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
