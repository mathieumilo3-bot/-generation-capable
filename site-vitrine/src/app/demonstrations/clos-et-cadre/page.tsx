import Link from "next/link";
import { BeforeAfter } from "@/components/demos/clos-et-cadre/BeforeAfter";
import { Drawing } from "@/components/demos/clos-et-cadre/Drawing";
import { ProjectCard } from "@/components/demos/clos-et-cadre/ProjectCard";
import { Faq, FinalCta, LocalPresence, Method, ProofHierarchy, ServicesOverview, Testimonials } from "@/components/demos/clos-et-cadre/sections";
import { Arrow, Container, Cta, SectionHeading, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { PROJECTS, getProject } from "@/lib/demos/clos-et-cadre/projects";

const featured = getProject("extension-maison-meuliere-chatou")!;
const compared = getProject("renovation-globale-pavillon-le-vesinet")!;

const COMMITMENTS = [
  { title: "Chantiers de 80 000 à 350 000 € HT", text: "Des projets qui engagent la structure et plusieurs corps d'état." },
  { title: "Un seul conducteur de travaux", text: "Le même interlocuteur du relevé à la levée des réserves." },
  { title: "Un devis lot par lot", text: "Quantités, matériaux, planning et échéancier lié à l'avancement." },
  { title: "Un point photo chaque semaine", text: "Pour suivre votre chantier, même à distance." },
];

export default function ClosEtCadreHome() {
  return (
    <>
      {/* Hero: who, what, where, why — and a real project, not a slogan. */}
      <section aria-labelledby="accroche" className="pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pt-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-14">
            <div>
              <p className="cc-label text-[var(--cc-accent)]">Rénovation · Extension · Surélévation — Yvelines &amp; Hauts-de-Seine</p>
              <h1 id="accroche" className="cc-serif text-balance mt-5 text-[38px] leading-[1.04] sm:text-[50px] lg:text-[50px] xl:text-[58px]">
                Agrandir, surélever ou rénover votre maison, <em className="text-[var(--cc-accent)]">sans vous perdre dans le chantier.</em>
              </h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-[var(--cc-muted)]">
                Extensions, surélévations et rénovations globales de Chatou à Versailles. Un conducteur de travaux unique pilote votre projet,
                de l&apos;étude à la livraison, avec un devis détaillé lot par lot et un planning tenu.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Cta href={`${DEMO_BASE_PATH}/projet`}>
                  Décrire votre projet <Arrow />
                </Cta>
                <Cta href={`${DEMO_BASE_PATH}/realisations`} variant="secondary">
                  Voir nos réalisations
                </Cta>
              </div>
              <p className="mt-6 text-[15px] text-[var(--cc-muted)]">
                Ou appelez le{" "}
                <a href={COMPANY.phoneHref} className="cc-link tabular-nums text-[var(--cc-ink)]">
                  {COMPANY.phoneDisplay}
                </a>{" "}
                — du lundi au vendredi.
              </p>
            </div>

            <figure className="relative">
              <Link href={`${DEMO_BASE_PATH}/realisations/${featured.slug}`} className="group block overflow-hidden bg-[var(--cc-paper)]">
                <div className="transition-transform duration-700 ease-[var(--cc-ease)] group-hover:scale-[1.02]">
                  <Drawing scene={featured.scene} state="after" uid="hero" />
                </div>
                <figcaption className="flex flex-col gap-1 bg-[var(--cc-ink)] px-5 py-4 text-[var(--cc-bg)] sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span>
                    <span className="cc-label block text-[11px] text-[#d9a283]">Réalisation · {featured.commune}</span>
                    <span className="cc-serif mt-1 block text-[21px] leading-snug">{featured.shortTitle}</span>
                  </span>
                  <span className="text-[13.5px] text-[#cfc8bd]">
                    38 m² créés · 14 semaines de chantier · maison habitée
                  </span>
                </figcaption>
              </Link>
              <StrategyNote title="Hero" className="mt-4">
                Qui, quoi, où, pourquoi eux, et quoi faire : lisible en cinq secondes. Le visuel n&apos;est pas une ambiance, c&apos;est un
                chantier cliquable avec ses chiffres. Sur le site réel, il accueille la meilleure photo du meilleur chantier.
              </StrategyNote>
            </figure>
          </div>

          <ul className="mt-14 grid gap-px border-y border-[var(--cc-line)] bg-[var(--cc-line)] sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            {COMMITMENTS.map((item) => (
              <li key={item.title} className="bg-[var(--cc-bg)] py-6 sm:px-6 lg:first:pl-0">
                <p className="text-[16px] font-medium">{item.title}</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--cc-muted)]">{item.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Realisations: the heart of the site. */}
      <section aria-labelledby="realisations-titre" className="bg-[var(--cc-paper)] py-20 sm:py-28">
        <Container>
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <SectionHeading
              kicker="Réalisations"
              title={<span id="realisations-titre">Des chantiers comparables au vôtre, documentés comme tels.</span>}
              intro="Le bâti, la contrainte, la solution, la durée et l'enveloppe : pour chaque projet, ce qu'il faut savoir pour vous projeter."
            />
            <Link href={`${DEMO_BASE_PATH}/realisations`} className="inline-flex shrink-0 items-center gap-2 text-[15px] font-medium hover:text-[var(--cc-accent)]">
              Toutes les réalisations <Arrow />
            </Link>
          </div>
          <StrategyNote title="Le portfolio est le cœur du site" className="mt-8 max-w-3xl">
            Un dirigeant qui facture 150 000 € ne vend pas des photos, il vend la certitude d&apos;avoir déjà résolu le problème du prospect.
            Chaque carte affiche donc la situation de départ et les trois chiffres qui permettent de se reconnaître : surface, durée, budget.
          </StrategyNote>
          <div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-2">
            {PROJECTS.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </Container>
      </section>

      {/* Before / after */}
      <section aria-labelledby="avant-apres-titre" className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
            <SectionHeading
              kicker="Avant, après"
              title={<span id="avant-apres-titre">Ce qui a changé, et ce qu&apos;il a fallu faire pour y arriver.</span>}
            />
            <p className="max-w-xl text-[17px] leading-relaxed text-[var(--cc-muted)]">
              {compared.shortTitle}, {compared.commune} : {compared.facts.surface.toLowerCase()}, {compared.facts.duration}. Faites glisser
              la poignée pour comparer l&apos;existant et le résultat.
            </p>
          </div>
          <BeforeAfter scene={compared.scene} explanation={compared.beforeAfter} className="mt-12" />
          <div className="mt-8">
            <Link href={`${DEMO_BASE_PATH}/realisations/${compared.slug}`} className="inline-flex items-center gap-2 text-[15px] font-medium hover:text-[var(--cc-accent)]">
              Lire le détail de ce chantier <Arrow />
            </Link>
          </div>
        </Container>
      </section>

      <ServicesOverview />
      <Method />
      <ProofHierarchy />
      <Testimonials />
      <LocalPresence />
      <Faq />
      <FinalCta />
    </>
  );
}
