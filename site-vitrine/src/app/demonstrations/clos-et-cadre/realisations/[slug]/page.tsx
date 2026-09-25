import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BeforeAfter } from "@/components/demos/clos-et-cadre/BeforeAfter";
import { Drawing, sceneCaption } from "@/components/demos/clos-et-cadre/Drawing";
import { ProjectCard } from "@/components/demos/clos-et-cadre/ProjectCard";
import { Arrow, Container, Cta, Kicker, Slot, SlotBlock, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { PROJECTS, getProject, type Project } from "@/lib/demos/clos-et-cadre/projects";
import { getService } from "@/lib/demos/clos-et-cadre/services";

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps<"/demonstrations/clos-et-cadre/realisations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.shortTitle} à ${project.commune}`,
    description: project.situation,
    alternates: { canonical: `${DEMO_BASE_PATH}/realisations/${project.slug}` },
  };
}

const FACT_LABELS: [keyof Project["facts"], string][] = [
  ["building", "Bâti"],
  ["surface", "Surface"],
  ["duration", "Durée"],
  ["budget", "Enveloppe travaux"],
  ["occupancy", "Occupation"],
  ["authorisation", "Autorisation"],
];

export default async function ProjectPage({ params }: PageProps<"/demonstrations/clos-et-cadre/realisations/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const service = getService(project.service);
  const others = PROJECTS.filter((candidate) => candidate.slug !== project.slug).slice(0, 2);

  return (
    <>
      <article>
        <header className="pb-12 pt-10 sm:pt-14">
          <Container>
            <nav aria-label="Fil d'Ariane" className="text-[14px] text-[var(--cc-muted)]">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href={DEMO_BASE_PATH} className="hover:text-[var(--cc-ink)]">
                    Accueil
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`${DEMO_BASE_PATH}/realisations`} className="hover:text-[var(--cc-ink)]">
                    Réalisations
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-[var(--cc-ink)]">
                  {project.commune}
                </li>
              </ol>
            </nav>

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
              <div>
                <Kicker>
                  {service.name} · {project.commune}
                </Kicker>
                <h1 className="cc-serif text-balance mt-4 text-[36px] leading-[1.06] sm:text-[48px] lg:text-[56px]">{project.title}</h1>
                <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-[var(--cc-muted)]">{project.situation}</p>
              </div>
              <dl className="self-end border-t border-[var(--cc-line)]">
                {FACT_LABELS.map(([key, label]) => (
                  <div key={key} className="grid grid-cols-[130px_1fr] gap-4 border-b border-[var(--cc-line)] py-3 text-[15px]">
                    <dt className="text-[var(--cc-muted)]">{label}</dt>
                    <dd>{project.facts[key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Container>
        </header>

        <Container>
          <figure>
            <div className="bg-[var(--cc-paper)]">
              <Drawing scene={project.scene} state="after" uid="projet-principal" />
            </div>
            <figcaption className="mt-3 text-[13.5px] text-[var(--cc-muted)]">{sceneCaption(project.scene, "after")}</figcaption>
          </figure>
        </Container>

        <section aria-labelledby="depart" className="py-16 sm:py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <Kicker>Le point de départ</Kicker>
                <h2 id="depart" className="cc-serif mt-4 text-[30px] leading-tight sm:text-[36px]">
                  La problématique
                </h2>
                <p className="mt-5 text-[17px] leading-relaxed">{project.problem}</p>
                <h3 className="cc-label mt-10 text-[var(--cc-muted)]">Les contraintes du chantier</h3>
                <ul className="mt-4 border-t border-[var(--cc-line)]">
                  {project.constraints.map((constraint) => (
                    <li key={constraint} className="border-b border-[var(--cc-line)] py-3 text-[16px]">
                      {constraint}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Kicker>Notre réponse</Kicker>
                <h2 className="cc-serif mt-4 text-[30px] leading-tight sm:text-[36px]">La solution apportée</h2>
                <p className="mt-5 text-[17px] leading-relaxed">{project.solution}</p>
                <h3 className="cc-label mt-10 text-[var(--cc-muted)]">Corps d&apos;état coordonnés</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {project.lots.map((lot) => (
                    <li key={lot} className="border border-[var(--cc-line)] px-3 py-1.5 text-[14px]">
                      {lot}
                    </li>
                  ))}
                </ul>
                <StrategyNote title="Une page projet comme un cabinet d'architecte" className="mt-8">
                  Problématique, contraintes, solution, détails techniques, résultat : c&apos;est ce qui permet au prospect de penser
                  « c&apos;est exactement ma maison ». Les contraintes montrent aussi, sans le dire, que l&apos;entreprise sait gérer
                  l&apos;imprévu.
                </StrategyNote>
              </div>
            </div>
          </Container>
        </section>

        <section aria-labelledby="avant-apres" className="bg-[var(--cc-paper)] py-16 sm:py-24">
          <Container>
            <Kicker>Avant, après</Kicker>
            <h2 id="avant-apres" className="cc-serif mt-4 text-[30px] leading-tight sm:text-[36px]">
              Comparer l&apos;existant et l&apos;état livré
            </h2>
            <BeforeAfter scene={project.scene} explanation={project.beforeAfter} className="mt-10" />
          </Container>
        </section>

        <section aria-labelledby="technique" className="py-16 sm:py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <Kicker>Détails techniques</Kicker>
                <h2 id="technique" className="cc-serif mt-4 text-[30px] leading-tight sm:text-[36px]">
                  Ce qui ne se voit plus une fois le chantier fini.
                </h2>
              </div>
              <dl className="border-t border-[var(--cc-line)]">
                {project.technical.map((item) => (
                  <div key={item.label} className="grid gap-1 border-b border-[var(--cc-line)] py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
                    <dt className="cc-label pt-0.5 text-[var(--cc-muted)]">{item.label}</dt>
                    <dd className="text-[16px]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-16 grid gap-10 border-t border-[var(--cc-line)] pt-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <Kicker>Le résultat</Kicker>
              </div>
              <p className="cc-serif text-[26px] leading-snug sm:text-[32px]">{project.result}</p>
            </div>
          </Container>
        </section>

        <section aria-label="Photographies et témoignage" className="pb-16 sm:pb-24">
          <Container>
            <div className="grid gap-6 lg:grid-cols-2">
              <SlotBlock
                title="photographies du chantier"
                need="Douze à vingt photos : l'existant, les étapes clés (fondations, ouverture du mur, mise hors d'eau) et le résultat livré, prises au même point de vue que les plans pour prolonger la comparaison."
              />
              <SlotBlock title="témoignage du client" need="Recueilli à la réception, avec l'accord écrit du client : ce qu'il craignait avant de signer, et ce qu'il en dit aujourd'hui.">
                <p className="mt-4 text-[14px]">
                  <Slot value={{ toFill: "Prénom, nom, commune" }} />
                </p>
              </SlotBlock>
            </div>
          </Container>
        </section>
      </article>

      <section aria-labelledby="comparable" className="bg-[var(--cc-dark)] py-16 text-[var(--cc-on-dark)] sm:py-20">
        <Container>
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="cc-label text-[#d9a283]">{service.name}</p>
              <h2 id="comparable" className="cc-serif mt-4 text-[32px] leading-tight sm:text-[42px]">
                Un projet comparable ? Décrivez-le, nous vous rappelons avec un premier avis.
              </h2>
            </div>
            <Cta href={`${DEMO_BASE_PATH}/projet?type=${project.service}`} variant="light" className="shrink-0">
              Décrire mon projet <Arrow />
            </Cta>
          </div>
        </Container>
      </section>

      <section aria-labelledby="autres" className="py-16 sm:py-24">
        <Container>
          <div className="flex items-end justify-between gap-6">
            <h2 id="autres" className="cc-serif text-[30px] leading-tight sm:text-[36px]">
              Autres réalisations
            </h2>
            <Link href={`${DEMO_BASE_PATH}/realisations`} className="inline-flex shrink-0 items-center gap-2 text-[15px] font-medium hover:text-[var(--cc-accent)]">
              Toutes <Arrow />
            </Link>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-2">
            {others.map((other) => (
              <ProjectCard key={other.slug} project={other} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
