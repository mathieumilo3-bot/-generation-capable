import Link from "next/link";
import { COMMUNES, COMPANY, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import { FAQ, STEPS } from "@/lib/demos/clos-et-cadre/method";
import { PROJECTS, getProject } from "@/lib/demos/clos-et-cadre/projects";
import { SERVICES } from "@/lib/demos/clos-et-cadre/services";
import { Drawing } from "./Drawing";
import { Arrow, Container, Cta, SectionHeading, Slot, SlotBlock, StrategyNote } from "./ui";

/* ------------------------------------------------------------------------ */
/* Services, as a list of situations linked to proof.                       */
/* ------------------------------------------------------------------------ */

export function ServicesOverview() {
  return (
    <section aria-labelledby="expertises-titre" className="border-t border-[var(--cc-line)] py-20 sm:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <div>
            <SectionHeading
              kicker="Expertises"
              title={<span id="expertises-titre">Quatre types de chantiers, que nous conduisons de bout en bout.</span>}
              intro="Nous ne faisons pas « tous travaux ». Nous prenons en charge des projets qui engagent la structure et plusieurs corps d'état, là où la coordination fait la différence."
            />
            <StrategyNote title="Pourquoi pas une grille de services" className="mt-8">
              Un prospect ne cherche pas « Extension » : il cherche quelqu&apos;un qui a déjà résolu sa situation. Chaque ligne commence donc par
              la promesse, dit pour qui, annonce un ordre de budget — ce qui filtre en amont — et renvoie vers un chantier comparable.
            </StrategyNote>
          </div>
          <ul className="border-t border-[var(--cc-line)]">
            {SERVICES.map((service) => {
              const project = getProject(service.projects[0]);
              return (
                <li key={service.id} className="border-b border-[var(--cc-line)] py-8">
                  <Link href={`${DEMO_BASE_PATH}/expertises#${service.id}`} className="group block">
                    <div className="flex items-baseline justify-between gap-6">
                      <h3 className="cc-serif text-[28px] leading-tight sm:text-[32px]">{service.name}</h3>
                      <Arrow className="shrink-0 text-[var(--cc-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--cc-ink)]" />
                    </div>
                    <p className="mt-2 text-[17px]">{service.promise}</p>
                    <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[var(--cc-muted)]">{service.forWhom}</p>
                  </Link>
                  <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
                    <div className="flex gap-2">
                      <dt className="text-[var(--cc-muted)]">Budget</dt>
                      <dd>{service.typicalBudget}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-[var(--cc-muted)]">Durée</dt>
                      <dd>{service.typicalDuration}</dd>
                    </div>
                    {project && (
                      <div className="flex gap-2">
                        <dt className="text-[var(--cc-muted)]">Exemple</dt>
                        <dd>
                          <Link href={`${DEMO_BASE_PATH}/realisations/${project.slug}`} className="cc-link">
                            {project.shortTitle}, {project.commune}
                          </Link>
                        </dd>
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Method: what happens after the click.                                    */
/* ------------------------------------------------------------------------ */

export function Method({ compact = false }: { compact?: boolean }) {
  return (
    <section id="methode" aria-labelledby="methode-titre" className="bg-[var(--cc-dark)] py-20 text-[var(--cc-on-dark)] sm:py-28">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className="cc-label text-[#d9a283]">Méthode</p>
            <h2 id="methode-titre" className="cc-serif text-balance mt-4 text-[34px] leading-[1.08] sm:text-[44px] lg:text-[52px]">
              Ce qui se passe après votre demande, étape par étape.
            </h2>
          </div>
          <p className="max-w-xl text-[17px] leading-relaxed text-[var(--cc-on-dark-muted)]">
            Un seul conducteur de travaux vous suit du premier appel à la levée des réserves. À chaque étape, vous savez ce que nous faisons
            et ce que vous recevez.
          </p>
        </div>

        <StrategyNote title="Faire disparaître l'incertitude" className="mt-10 max-w-3xl">
          La première cause d&apos;hésitation sur un chantier à six chiffres, c&apos;est l&apos;inconnu : qui rappelle, quand, pour quoi faire,
          quand est-ce qu&apos;on signe. Chaque étape nomme une durée et un livrable concret — c&apos;est ce qui rend le clic sur « Décrire votre
          projet » sans risque.
        </StrategyNote>

        <ol className={`mt-14 grid gap-px bg-white/10 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"}`}>
          {STEPS.map((step) => (
            <li key={step.number} className="flex flex-col bg-[var(--cc-dark)] p-6 sm:p-7">
              <div className="flex items-baseline justify-between gap-4">
                <span className="cc-serif text-[40px] leading-none text-[#d9a283]">{step.number}</span>
                <span className="text-right text-[13px] text-[var(--cc-on-dark-muted)]">{step.duration}</span>
              </div>
              <h3 className="mt-6 text-[19px] font-medium">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--cc-on-dark-muted)]">{step.what}</p>
              <p className="mt-auto border-t border-white/10 pt-4 text-[14px] leading-relaxed">
                <span className="text-[var(--cc-on-dark-muted)]">Vous recevez : </span>
                {step.youGet}
              </p>
            </li>
          ))}
          <li className="flex flex-col justify-between gap-6 bg-[#2a2723] p-6 sm:p-7">
            <p className="cc-serif text-[26px] leading-tight">La première étape prend quatre minutes.</p>
            <Cta href={`${DEMO_BASE_PATH}/projet`} variant="light" className="self-start">
              Décrire votre projet <Arrow />
            </Cta>
          </li>
        </ol>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Proof hierarchy. Real only — everything else is a visible slot.          */
/* ------------------------------------------------------------------------ */

const PROOFS = [
  {
    rank: "01",
    title: "Des réalisations documentées",
    body: "Chaque chantier présenté indique la commune, le bâti, la surface, la durée, l'enveloppe et les contraintes rencontrées.",
    proof: "available" as const,
    link: { href: `${DEMO_BASE_PATH}/realisations`, label: "Voir les réalisations" },
  },
  {
    rank: "02",
    title: "L'assurance décennale, nommée",
    body: "Assureur, numéro de police et activités couvertes, avec l'attestation remise dès le devis.",
    proof: "slot" as const,
    slot: "Assureur, n° de police et activités couvertes",
  },
  {
    rank: "03",
    title: "Des avis vérifiables",
    body: "La note et les avis de la fiche Google de l'entreprise, avec un lien direct vers la source.",
    proof: "slot" as const,
    slot: "Note Google et nombre d'avis, avec lien vers la fiche",
  },
  {
    rank: "04",
    title: "Des qualifications à jour",
    body: "Qualifications professionnelles (par exemple Qualibat, RGE) avec leur numéro et leur date de validité.",
    proof: "slot" as const,
    slot: "Qualifications réellement détenues, n° et validité",
  },
  {
    rank: "05",
    title: "Une entreprise qui dure",
    body: "Année de création, effectif, chantiers livrés : des chiffres que le prospect peut vérifier.",
    proof: "slot" as const,
    slot: "Année de création, effectif, chantiers livrés",
  },
];

export function ProofHierarchy() {
  return (
    <section aria-labelledby="preuves-titre" className="py-20 sm:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <div>
            <SectionHeading
              kicker="Avant de signer"
              title={<span id="preuves-titre">Ce que vous pouvez vérifier, sans nous croire sur parole.</span>}
              intro="Confier sa maison à une entreprise, c'est un engagement de plusieurs mois et de plusieurs centaines de milliers d'euros. Voici les preuves que nous mettons à votre disposition, dans l'ordre où elles comptent."
            />
            <StrategyNote title="Hiérarchie de confiance" className="mt-8">
              Les preuves sont classées par poids dans la décision, pas par facilité à afficher. Aucune n&apos;est inventée : tant que
              l&apos;entreprise ne les a pas fournies, elles restent des emplacements « à compléter », visibles comme tels. Un faux compteur
              « 98 % de clients satisfaits » détruit plus de confiance qu&apos;il n&apos;en crée.
            </StrategyNote>
          </div>
          <ol className="border-t border-[var(--cc-line)]">
            {PROOFS.map((proof) => (
              <li key={proof.rank} className="grid grid-cols-[48px_1fr] gap-4 border-b border-[var(--cc-line)] py-7 sm:grid-cols-[64px_1fr]">
                <span className="cc-serif text-[26px] leading-none text-[var(--cc-accent)]">{proof.rank}</span>
                <div>
                  <h3 className="text-[19px] font-medium">{proof.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-[var(--cc-muted)]">{proof.body}</p>
                  <div className="mt-4">
                    {proof.proof === "available" ? (
                      <Link href={proof.link.href} className="inline-flex items-center gap-2 text-[15px] font-medium hover:text-[var(--cc-accent)]">
                        {proof.link.label} <Arrow />
                      </Link>
                    ) : (
                      <Slot value={{ toFill: proof.slot }} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Testimonials: always tied to a project. Frames only, until real ones.    */
/* ------------------------------------------------------------------------ */

export function Testimonials({ slugs = ["extension-maison-meuliere-chatou", "surelevation-pavillon-rueil-malmaison"] }: { slugs?: string[] }) {
  const projects = slugs.map((slug) => getProject(slug)).filter((project) => project !== undefined);
  return (
    <section aria-labelledby="temoignages-titre" className="bg-[var(--cc-paper)] py-20 sm:py-28">
      <Container>
        <SectionHeading
          kicker="Ils nous ont confié leur maison"
          title={<span id="temoignages-titre">Chaque témoignage est rattaché au chantier dont il parle.</span>}
          intro="Un nom, une commune, un projet, des photos : c'est ce qui distingue un témoignage d'une citation."
        />
        <StrategyNote title="Témoignage en contexte" className="mt-8 max-w-3xl">
          Structure prête à recevoir de vrais témoignages, recueillis à la réception du chantier (écrit ou vidéo de 60 secondes, avec
          l&apos;accord écrit du client). Tant qu&apos;ils n&apos;existent pas, le cadre reste vide : jamais de citation inventée.
        </StrategyNote>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {projects.map((project) => (
            <figure key={project.slug} className="grid gap-0 bg-[var(--cc-bg)] sm:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-[var(--cc-stone)]">
                <Drawing scene={project.scene} state="after" uid={`temoin-${project.slug}`} titleBlock={false} className="h-full object-cover" />
              </div>
              <div className="flex flex-col p-6 sm:p-7">
                <p className="cc-label text-[11.5px] text-[var(--cc-accent)]">
                  {project.shortTitle} · {project.commune}
                </p>
                <blockquote className="mt-4 flex-1">
                  <SlotBlock title="témoignage" need="Les mots du client, recueillis à la réception : ce qu'il craignait, ce qui s'est passé, ce qu'il en dit aujourd'hui." className="p-4" />
                </blockquote>
                <figcaption className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
                  <Slot value={{ toFill: "Prénom, nom (avec accord)" }} />
                  <Link href={`${DEMO_BASE_PATH}/realisations/${project.slug}`} className="cc-link text-[var(--cc-muted)]">
                    Voir le chantier
                  </Link>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Local presence: a schematic map of the served communes.                  */
/* ------------------------------------------------------------------------ */

const GEO: Record<string, [number, number]> = {
  "Maisons-Laffitte": [48.947, 2.146],
  "Saint-Germain-en-Laye": [48.898, 2.093],
  "Le Pecq": [48.893, 2.106],
  "Le Vésinet": [48.894, 2.131],
  "Croissy-sur-Seine": [48.878, 2.139],
  Chatou: [48.889, 2.157],
  "Rueil-Malmaison": [48.877, 2.18],
  Suresnes: [48.871, 2.225],
  "Saint-Cloud": [48.844, 2.219],
  Garches: [48.846, 2.188],
  Vaucresson: [48.84, 2.16],
  "Marly-le-Roi": [48.867, 2.094],
  Louveciennes: [48.861, 2.115],
  Bougival: [48.865, 2.139],
  Versailles: [48.805, 2.13],
};

const SEINE: [number, number][] = [
  [48.822, 2.215],
  [48.845, 2.226],
  [48.872, 2.232],
  [48.886, 2.2],
  [48.891, 2.168],
  [48.878, 2.145],
  [48.868, 2.13],
  [48.878, 2.11],
  [48.896, 2.112],
  [48.92, 2.12],
  [48.95, 2.155],
];

function project([lat, lon]: [number, number]): [number, number] {
  return [60 + (lon - 2.085) * 3200, 40 + (48.955 - lat) * 3200 * 1.5];
}

export function ZoneMap() {
  const projectCommunes = new Set(PROJECTS.map((p) => p.commune));
  const seine = SEINE.map(project);
  const seinePath = seine.reduce((path, [x, y], index) => {
    if (index === 0) return `M${x} ${y}`;
    const [px, py] = seine[index - 1];
    const cx = (px + x) / 2;
    const cy = (py + y) / 2;
    return `${path} Q${px} ${py} ${cx} ${cy}`;
  }, "");
  return (
    <svg viewBox="0 0 600 780" role="img" aria-label="Schéma de la zone d'intervention : communes desservies des Yvelines et des Hauts-de-Seine" className="h-auto w-full">
      <rect width="600" height="780" fill="var(--cc-paper)" />
      <path d={`${seinePath} L${seine.at(-1)![0]} ${seine.at(-1)![1]}`} fill="none" stroke="#9fb0b2" strokeWidth="14" strokeLinecap="round" opacity="0.7" />
      <text x={seine[2][0] - 8} y={seine[2][1] - 34} fontSize="13" fill="#6f8386" fontStyle="italic" fontFamily="var(--font-cc-serif), serif" textAnchor="end">
        la Seine
      </text>
      {COMMUNES.map((commune) => {
        const [x, y] = project(GEO[commune.name]);
        const hasProject = projectCommunes.has(commune.name);
        const labelLeft = x > 420;
        return (
          <g key={commune.name}>
            <circle cx={x} cy={y} r={hasProject ? 9 : 5} fill={hasProject ? "var(--cc-accent)" : "var(--cc-ink)"} />
            {hasProject && <circle cx={x} cy={y} r="16" fill="none" stroke="var(--cc-accent)" strokeOpacity="0.4" />}
            <text
              x={labelLeft ? x - 14 : x + 14}
              y={y + 4}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize="14"
              fill="var(--cc-ink)"
              fontFamily="var(--font-cc-sans), sans-serif"
              fontWeight={hasProject ? 600 : 400}
            >
              {commune.name}
            </text>
          </g>
        );
      })}
      <text x="30" y="760" fontSize="12" fill="var(--cc-muted)" fontFamily="var(--font-cc-sans), sans-serif">
        Schéma indicatif, non à l&apos;échelle — Yvelines (78) et Hauts-de-Seine (92)
      </text>
    </svg>
  );
}

export function LocalPresence() {
  return (
    <section aria-labelledby="zone-titre" className="py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <SectionHeading
              kicker="Secteur d'intervention"
              title={<span id="zone-titre">À moins de 30 minutes de chacun de nos chantiers.</span>}
              intro="Nous travaillons dans les Yvelines et les Hauts-de-Seine, autour de la boucle de la Seine. Cette proximité n'est pas un détail : c'est ce qui permet au conducteur de travaux de passer sur votre chantier plusieurs fois par semaine."
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="cc-label text-[var(--cc-muted)]">Nous joindre</p>
                <a href={COMPANY.phoneHref} className="cc-serif mt-3 block text-[30px] leading-none tabular-nums hover:text-[var(--cc-accent)]">
                  {COMPANY.phoneDisplay}
                </a>
                <p className="mt-3 text-[15px] text-[var(--cc-muted)]">{COMPANY.hours}</p>
                <p className="mt-1 text-[15px] text-[var(--cc-muted)]">{COMPANY.visitsNote}</p>
              </div>
              <div className="space-y-3 text-[15px]">
                <p className="cc-label text-[var(--cc-muted)]">Nous trouver</p>
                <p>
                  <Slot value={COMPANY.address} />
                </p>
                <p>
                  <Slot value={COMPANY.googleProfile} />
                </p>
              </div>
            </div>
            <div className="mt-10">
              <p className="cc-label text-[var(--cc-muted)]">Communes desservies</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {COMMUNES.map((commune) => (
                  <li key={commune.name} className="border border-[var(--cc-line)] px-3 py-1.5 text-[14px]">
                    {commune.name}
                  </li>
                ))}
              </ul>
            </div>
            <StrategyNote title="Ancrage local sans pages-portes" className="mt-8">
              Pas de vingt pages « Rénovation à [ville] » au contenu dupliqué : une page locale n&apos;est créée que lorsque l&apos;entreprise y a
              de vrais chantiers à montrer. Ici, la carte relie chaque commune aux réalisations qui s&apos;y trouvent.
            </StrategyNote>
          </div>
          <div className="lg:pt-4">
            <ZoneMap />
            <p className="mt-3 flex items-center gap-2 text-[13.5px] text-[var(--cc-muted)]">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--cc-accent)]" /> Communes avec une réalisation
              présentée sur ce site
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Objections, answered.                                                    */
/* ------------------------------------------------------------------------ */

export function Faq() {
  return (
    <section aria-labelledby="questions-titre" className="border-t border-[var(--cc-line)] py-20 sm:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <SectionHeading kicker="Vos questions" title={<span id="questions-titre">Ce que nos clients nous demandent avant de s&apos;engager.</span>} />
          <div className="border-t border-[var(--cc-line)]">
            {FAQ.map((item) => (
              <details key={item.question} className="group border-b border-[var(--cc-line)]">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="relative h-4 w-4 shrink-0">
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-current transition-transform group-open:rotate-90" />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-[var(--cc-muted)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Final call to action: says exactly what will be asked.                   */
/* ------------------------------------------------------------------------ */

export function FinalCta() {
  return (
    <section aria-labelledby="demande-titre" className="bg-[var(--cc-dark)] py-20 text-[var(--cc-on-dark)] sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="cc-label text-[#d9a283]">Votre projet</p>
            <h2 id="demande-titre" className="cc-serif text-balance mt-4 text-[36px] leading-[1.06] sm:text-[48px] lg:text-[58px]">
              Décrivez votre projet. Le conducteur de travaux qui le suivrait vous rappelle.
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--cc-on-dark-muted)]">
              Quatre minutes pour nous donner l&apos;essentiel ; un rappel sous deux jours ouvrés, au créneau que vous choisissez. Si votre
              projet ne correspond pas à ce que nous faisons, nous vous le disons, et vers qui vous tourner.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Cta href={`${DEMO_BASE_PATH}/projet`} variant="light">
                Décrire votre projet <Arrow />
              </Cta>
              <a href={COMPANY.phoneHref} className="inline-flex min-h-12 items-center justify-center border border-white/25 px-6 text-[15px] hover:border-white">
                Appeler le {COMPANY.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="cc-label text-[var(--cc-on-dark-muted)]">Nous vous demanderons</p>
            <ul className="mt-4 space-y-2.5 text-[15.5px]">
              {["Le type de projet et de bien", "La commune et l'époque de construction", "Les surfaces, même approximatives", "Votre horizon et votre enveloppe", "Quelques photos, si vous en avez"].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[11px] h-px w-4 shrink-0 bg-[#d9a283]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
