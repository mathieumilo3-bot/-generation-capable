import type { Metadata } from "next";
import { FinalCta, LocalPresence, ProofHierarchy } from "@/components/demos/clos-et-cadre/sections";
import { Container, Kicker, SectionHeading, Slot, SlotBlock, StrategyNote } from "@/components/demos/clos-et-cadre/ui";
import { BRIEF, COMPANY, DEMO_BASE_PATH, toFill } from "@/lib/demos/clos-et-cadre/company";

export const metadata: Metadata = {
  title: "L'entreprise",
  description: "Comment nous travaillons, qui pilote votre chantier, les garanties et assurances qui vous couvrent, et où nous intervenons.",
  alternates: { canonical: `${DEMO_BASE_PATH}/entreprise` },
};

const GUARANTEES = [
  {
    name: "Garantie de parfait achèvement",
    duration: "1 an",
    text: "Tout désordre signalé à la réception ou dans l'année qui suit est repris par l'entreprise, quelle que soit sa gravité.",
  },
  {
    name: "Garantie de bon fonctionnement",
    duration: "2 ans",
    text: "Couvre les équipements dissociables de l'ouvrage : volets, radiateurs, robinetterie, portes intérieures…",
  },
  {
    name: "Garantie décennale",
    duration: "10 ans",
    text: "Couvre les dommages qui compromettent la solidité de l'ouvrage ou le rendent impropre à sa destination. Attestation remise avec le devis.",
  },
  {
    name: "Assurance dommages-ouvrage",
    duration: "À souscrire par le maître d'ouvrage",
    text: "Elle permet d'être indemnisé sans attendre une décision sur les responsabilités. Nous vous indiquons les pièces dont votre assureur aura besoin.",
  },
];

const FACTS = [
  { label: "Création", value: COMPANY.founded },
  { label: "Effectif", value: COMPANY.team },
  { label: "Chantiers livrés", value: COMPANY.deliveredProjects },
  { label: "Assurance décennale", value: toFill("Assureur et n° de police") },
  { label: "Qualifications", value: toFill("Qualifications détenues et validité") },
  { label: "Immatriculation", value: COMPANY.siren },
];

export default function EntreprisePage() {
  return (
    <>
      <section className="pb-16 pt-12 sm:pb-24 sm:pt-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
            <div>
              <SectionHeading
                as="h1"
                kicker="L'entreprise"
                title="Une entreprise générale, organisée pour les chantiers qui engagent toute une maison."
                intro={BRIEF.trade}
              />
              <h2 className="cc-label mt-12 text-[var(--cc-muted)]">Ce qui ne change pas d&apos;un chantier à l&apos;autre</h2>
              <ul className="mt-4 border-t border-[var(--cc-line)]">
                {BRIEF.differentiators.map((item) => (
                  <li key={item} className="border-b border-[var(--cc-line)] py-4 text-[17px]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="border border-[var(--cc-line)] p-6">
                <p className="cc-label text-[var(--cc-muted)]">Fiche entreprise</p>
                <dl className="mt-4">
                  {FACTS.map((fact) => (
                    <div key={fact.label} className="flex flex-col gap-1 border-b border-[var(--cc-line)] py-3 last:border-0">
                      <dt className="text-[14px] text-[var(--cc-muted)]">{fact.label}</dt>
                      <dd className="text-[15.5px]">
                        <Slot value={fact.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <StrategyNote title="Aucun chiffre inventé" className="mt-6">
                Pas de compteur « 20 ans d&apos;expérience, 500 chantiers » : chaque donnée de cette fiche est fournie et vérifiable, ou
                reste visiblement à compléter. Un dirigeant qui lit ses propres chiffres sur la maquette sait qu&apos;on ne lui a rien inventé.
              </StrategyNote>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="equipe" className="bg-[var(--cc-paper)] py-16 sm:py-24">
        <Container>
          <SectionHeading
            kicker="Qui pilote votre chantier"
            title={<span id="equipe">Des visages et des noms, pas un standard téléphonique.</span>}
            intro="Le conducteur de travaux qui vous rappelle est celui qui suivra votre chantier. Il travaille avec des compagnons salariés et des partenaires réguliers, toujours les mêmes."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <SlotBlock title="dirigeant" need="Portrait, parcours, et pourquoi il a créé l'entreprise — en quelques lignes, avec sa voix." />
            <SlotBlock title="conducteurs de travaux" need="Portraits, prénoms et secteurs suivis : le visage de la personne qui rappellera le prospect." />
            <SlotBlock title="partenaires" need="Architecte partenaire, bureau d'études structure, fournisseurs principaux : nommés, avec leur accord." />
          </div>
        </Container>
      </section>

      <section aria-labelledby="garanties" className="py-16 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
            <div>
              <Kicker>Garanties</Kicker>
              <h2 id="garanties" className="cc-serif text-balance mt-4 text-[34px] leading-[1.08] sm:text-[44px]">
                Ce qui vous protège, expliqué simplement.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-[var(--cc-muted)]">
                Les garanties légales de la construction s&apos;appliquent à tous les chantiers. Encore faut-il savoir ce qu&apos;elles couvrent,
                et à qui s&apos;adresser.
              </p>
            </div>
            <dl className="border-t border-[var(--cc-line)]">
              {GUARANTEES.map((item) => (
                <div key={item.name} className="grid gap-2 border-b border-[var(--cc-line)] py-6 sm:grid-cols-[1fr_2fr] sm:gap-8">
                  <dt>
                    <span className="block text-[18px] font-medium">{item.name}</span>
                    <span className="mt-1 block text-[14px] text-[var(--cc-accent)]">{item.duration}</span>
                  </dt>
                  <dd className="text-[16px] leading-relaxed text-[var(--cc-muted)]">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <div className="border-t border-[var(--cc-line)]">
        <ProofHierarchy />
      </div>
      <div className="bg-[var(--cc-paper)]">
        <LocalPresence />
      </div>
      <FinalCta />
    </>
  );
}
