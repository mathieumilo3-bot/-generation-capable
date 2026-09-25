import type { Metadata } from "next";
import Link from "next/link";
import { Drawing } from "@/components/demos/clos-et-cadre/Drawing";
import { FinalCta, Method } from "@/components/demos/clos-et-cadre/sections";
import { Arrow, Container, Cta, Kicker, SectionHeading, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { getProject } from "@/lib/demos/clos-et-cadre/projects";
import { SERVICES } from "@/lib/demos/clos-et-cadre/services";

export const metadata: Metadata = {
  title: "Expertises",
  description: "Extension de maison, surélévation, rénovation globale et restructuration avec ouverture de murs porteurs : pour qui, dans quelles situations, et ce que nous prenons en charge.",
  alternates: { canonical: `${DEMO_BASE_PATH}/expertises` },
};

export default function ExpertisesPage() {
  return (
    <>
      <section className="pb-12 pt-12 sm:pt-16">
        <Container>
          <SectionHeading
            as="h1"
            kicker="Expertises"
            title="Quatre situations que nous savons résoudre, de l'étude à la livraison."
            intro="Pour chacune : à qui elle s'adresse, ce que vous obtenez, ce que nous prenons en charge, et un chantier qui le montre."
          />
          <nav aria-label="Expertises" className="mt-10 flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <a key={service.id} href={`#${service.id}`} className="inline-flex min-h-11 items-center border border-[var(--cc-line-strong)] px-4 text-[14.5px] hover:border-[var(--cc-ink)]">
                {service.name}
              </a>
            ))}
          </nav>
          <StrategyNote title="Chaque service est relié à ses preuves" className="mt-8 max-w-3xl">
            Pour qui, quelle situation, quel résultat, ce que l&apos;entreprise prend en charge — et la réglementation expliquée en une phrase.
            Montrer qu&apos;on connaît les seuils du permis de construire rassure plus qu&apos;un adjectif. Chaque bloc renvoie au chantier
            correspondant et au formulaire, pré-rempli avec le bon type de projet.
          </StrategyNote>
        </Container>
      </section>

      {SERVICES.map((service, index) => {
        const projects = service.projects.map((slug) => getProject(slug)).filter((project) => project !== undefined);
        const lead = projects[0];
        return (
          <section
            key={service.id}
            id={service.id}
            aria-labelledby={`${service.id}-titre`}
            className={`py-16 sm:py-24 ${index % 2 === 0 ? "bg-[var(--cc-paper)]" : ""}`}
          >
            <Container>
              <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
                <div>
                  <Kicker>0{index + 1} — {service.name}</Kicker>
                  <h2 id={`${service.id}-titre`} className="cc-serif text-balance mt-4 text-[32px] leading-[1.1] sm:text-[42px]">
                    {service.promise}
                  </h2>
                  <p className="mt-5 text-[17px] leading-relaxed text-[var(--cc-muted)]">{service.forWhom}</p>

                  <h3 className="cc-label mt-10 text-[var(--cc-muted)]">Vous êtes dans cette situation</h3>
                  <ul className="mt-4 border-t border-[var(--cc-line)]">
                    {service.situations.map((situation) => (
                      <li key={situation} className="border-b border-[var(--cc-line)] py-3 text-[16px]">
                        {situation}
                      </li>
                    ))}
                  </ul>

                  <h3 className="cc-label mt-10 text-[var(--cc-muted)]">Le résultat</h3>
                  <p className="mt-3 text-[17px] leading-relaxed">{service.outcome}</p>

                  <h3 className="cc-label mt-10 text-[var(--cc-muted)]">Ce que nous prenons en charge</h3>
                  <ul className="mt-4 space-y-2.5">
                    {service.weHandle.map((item) => (
                      <li key={item} className="flex gap-3 text-[16px]">
                        <span aria-hidden="true" className="mt-[12px] h-px w-4 shrink-0 bg-[var(--cc-accent)]" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 border-l-2 border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] px-5 py-4">
                    <p className="cc-label text-[var(--cc-accent)]">Bon à savoir</p>
                    <p className="mt-2 text-[15.5px] leading-relaxed">{service.goodToKnow}</p>
                  </div>
                </div>

                <div className="lg:pt-2">
                  <dl className="grid grid-cols-2 gap-6 border-y border-[var(--cc-line)] py-5">
                    <div>
                      <dt className="text-[14px] text-[var(--cc-muted)]">Budget indicatif</dt>
                      <dd className="mt-1 text-[17px]">{service.typicalBudget}</dd>
                    </div>
                    <div>
                      <dt className="text-[14px] text-[var(--cc-muted)]">Durée indicative</dt>
                      <dd className="mt-1 text-[17px]">{service.typicalDuration}</dd>
                    </div>
                  </dl>
                  {lead && (
                    <Link href={`${DEMO_BASE_PATH}/realisations/${lead.slug}`} className="group mt-8 block">
                      <div className="overflow-hidden bg-[var(--cc-bg)]">
                        <div className="transition-transform duration-700 ease-[var(--cc-ease)] group-hover:scale-[1.02]">
                          <Drawing scene={lead.scene} state="after" uid={`exp-${service.id}`} titleBlock={false} />
                        </div>
                      </div>
                      <p className="cc-label mt-4 text-[11.5px] text-[var(--cc-accent)]">Réalisation · {lead.commune}</p>
                      <p className="cc-serif mt-1 text-[22px] leading-snug group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                        {lead.shortTitle}
                      </p>
                      <p className="mt-1 text-[14.5px] text-[var(--cc-muted)]">
                        {lead.facts.surface} · {lead.facts.budget}
                      </p>
                    </Link>
                  )}
                  {projects.length > 1 && (
                    <p className="mt-5 text-[15px] text-[var(--cc-muted)]">
                      Voir aussi :{" "}
                      {projects.slice(1).map((project) => (
                        <Link key={project.slug} href={`${DEMO_BASE_PATH}/realisations/${project.slug}`} className="cc-link text-[var(--cc-ink)]">
                          {project.shortTitle.toLowerCase()} à {project.commune}
                        </Link>
                      ))}
                    </p>
                  )}
                  <Cta href={`${DEMO_BASE_PATH}/projet?type=${service.id}`} className="mt-8 w-full sm:w-auto">
                    Décrire un projet similaire <Arrow />
                  </Cta>
                </div>
              </div>
            </Container>
          </section>
        );
      })}

      <Method />
      <FinalCta />
    </>
  );
}
