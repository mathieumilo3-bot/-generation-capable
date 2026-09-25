import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { Drawing } from "@/components/demos/clos-et-cadre/Drawing";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { CONCEPT_CREDIT } from "@/lib/data/demonstrations";
import { BRIEF, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";

const PATH = "/etudes-de-cas/clos-et-cadre";

export const metadata: Metadata = {
  title: "Clos & Cadre — étude de cas construction",
  description:
    "Projet conceptuel : comment Génération Capable conçoit le site d'une entreprise de rénovation pour transformer un savoir-faire de chantier en demandes de projets qualifiées.",
  alternates: { canonical: PATH },
};

const PROBLEMS = [
  {
    title: "Le portfolio montre, il ne documente pas",
    text: "Une galerie de photos sans bâti, sans contrainte, sans durée ni budget. Le prospect voit de beaux chantiers ; il ne sait pas si l'entreprise a déjà résolu le sien.",
  },
  {
    title: "Les services sont une liste de métiers",
    text: "« Rénovation — Extension — Maçonnerie ». Rien sur pour qui, dans quelle situation, pour quel résultat — ni sur ce que l'entreprise prend en charge.",
  },
  {
    title: "La confiance repose sur des adjectifs",
    text: "« Sérieux, qualité, satisfaction » et parfois des compteurs invérifiables. Or un propriétaire qui engage 150 000 € veut des preuves, dans un ordre qui a du sens.",
  },
  {
    title: "Le parcours s'arrête à « Contactez-nous »",
    text: "Personne ne dit ce qui se passe après le clic. L'incertitude sur la suite est la première raison de repousser la demande.",
  },
  {
    title: "Le formulaire produit des demandes vides",
    text: "Nom, email, message. Chaque demande doit être requalifiée au téléphone, et les projets hors zone ou sous le seuil coûtent autant de temps que les bons.",
  },
  {
    title: "Le mobile est une version réduite",
    text: "Le prospect découvre l'entreprise sur son téléphone, souvent le soir. Téléphone introuvable, galeries lourdes, formulaire illisible : il remet à plus tard.",
  },
];

const RESPONSE = [
  {
    title: "Architecture",
    text: "Six gabarits seulement : accueil, réalisations, fiche chantier, expertises, entreprise, demande de projet. Chaque page renvoie vers une preuve et vers la demande, jamais vers une impasse.",
    link: { href: DEMO_BASE_PATH, label: "Accueil de la démonstration" },
  },
  {
    title: "Contenu",
    text: "Des fiches chantier construites comme celles d'un cabinet d'architecture : bâti, surface, durée, enveloppe, autorisation, problématique, contraintes, solution, détails techniques, résultat. Les services répondent à des situations et citent la réglementation en une phrase.",
    link: { href: `${DEMO_BASE_PATH}/realisations/extension-maison-meuliere-chatou`, label: "Une fiche chantier" },
  },
  {
    title: "Expérience",
    text: "Un comparateur avant/après accessible au clavier et au doigt, toujours accompagné de l'état initial, de l'intervention et du résultat. Sur mobile, une barre d'action permanente : appeler, ou décrire son projet.",
    link: { href: `${DEMO_BASE_PATH}/realisations/renovation-globale-pavillon-le-vesinet`, label: "Le comparateur" },
  },
  {
    title: "Formulaire",
    text: "Un pré-diagnostic en quatre étapes : type de projet, bien, attentes (calendrier, enveloppe, photos), coordonnées et créneau de rappel. À l'envoi, l'entreprise reçoit une fiche priorisée : zone, cohérence de l'enveloppe, autorisation d'urbanisme probable, points à vérifier en visite.",
    link: { href: `${DEMO_BASE_PATH}/projet`, label: "Tester le formulaire" },
  },
  {
    title: "Preuve",
    text: "Une hiérarchie explicite : réalisations documentées, assurance décennale nommée, avis vérifiables, qualifications, ancienneté. Tout ce que l'entreprise n'a pas encore fourni reste un emplacement « à compléter », visible comme tel.",
    link: { href: `${DEMO_BASE_PATH}/entreprise`, label: "La page entreprise" },
  },
];

const JOURNEY = [
  { stage: "Découverte", where: "Accueil", what: "Qui, quoi, où, pourquoi eux — et un chantier réel, cliquable, dès le premier écran." },
  { stage: "Confiance", where: "Méthode, garanties, preuves", what: "Ce qui se passe après la demande, étape par étape ; ce qui protège le client ; ce qu'il peut vérifier." },
  { stage: "Projection", where: "Réalisations, avant/après", what: "Un chantier comparable au sien, avec la contrainte, la solution, la durée et l'enveloppe." },
  { stage: "Qualification", where: "Demande de projet", what: "Quatre étapes qui donnent à l'entreprise de quoi décider si le projet est pour elle." },
  { stage: "Contact", where: "Rappel au créneau choisi", what: "Le conducteur de travaux rappelle avec la fiche projet sous les yeux, pas avec un questionnaire." },
];

const OBJECTIVES = [
  "Augmenter la part de demandes exploitables dès le premier contact, en réduisant les demandes hors zone ou sous le seuil de l'entreprise.",
  "Raccourcir le premier appel : l'entreprise connaît le projet, la commune, les surfaces et l'enveloppe avant de décrocher.",
  "Faire du portfolio un argument de vente : chaque chantier présenté doit pouvoir être cité par le commercial.",
  "Rendre la demande facile sur mobile, où se fait une large part des premières visites.",
  "Rendre mesurable chaque étape du parcours (vue de réalisation, début et fin de formulaire, appel) pour piloter les améliorations.",
];

const CAPABILITIES = [
  { title: "Analyser une activité", text: "Taille de chantier, zone, client idéal, projets rentables : le brief précède le design." },
  { title: "Comprendre le client final", text: "Ses hésitations sont listées et chacune reçoit une réponse précise dans le site." },
  { title: "Structurer une offre", text: "Quatre expertises définies par situation, budget et durée, reliées à leurs chantiers." },
  { title: "Créer de la confiance", text: "Une hiérarchie de preuves réelles — et le refus d'en inventer une seule." },
  { title: "Préparer la conversion", text: "Un pré-diagnostic progressif, pensé pour le téléphone, avec ses états d'erreur et de succès." },
  { title: "Connecter au processus commercial", text: "Une fiche priorisée, prête pour l'email ou le CRM, qui dit quoi faire ensuite." },
];

const TO_PROVIDE = [
  "Photographies des chantiers : existant, étapes clés, livré",
  "Attestation d'assurance décennale (assureur, police, activités)",
  "Qualifications réellement détenues et leur validité",
  "Lien vers la fiche Google et accord pour afficher les avis",
  "Témoignages recueillis à la réception, avec accord écrit",
  "Adresse, effectif, année de création, chantiers livrés",
  "Seuils de budget et ratios de coût, pour calibrer la qualification",
];

function Block({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="grid gap-8 border-t border-[var(--color-border)] py-14 lg:grid-cols-[280px_1fr] lg:gap-16">
      <div>
        <p className="font-display text-sm text-[var(--color-accent)]">{number}</p>
        <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function ClosEtCadreCaseStudy() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Études de cas", url: `${SITE_URL}/etudes-de-cas` },
          { name: "Clos & Cadre", url: `${SITE_URL}${PATH}` },
        ]}
      />
      <Section className="pb-12 pt-24 sm:pt-32">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Étude de cas · Construction</Badge>
          <span className="rounded-full border border-[var(--color-accent)]/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Projet conceptuel
          </span>
        </div>
        <h1 className="font-display text-balance mt-8 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Clos &amp; Cadre : un site qui vend des chantiers, pas des photos.
        </h1>
        <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-[var(--color-muted)]">
          Comment présenter une entreprise de rénovation qui facture des chantiers de 80 000 à 350 000 € pour qu&apos;un propriétaire se
          reconnaisse dans ses réalisations, lui fasse confiance, et lui transmette une demande déjà qualifiée.
        </p>

        <div className="mt-10 max-w-2xl border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-6 py-5 text-[15px] leading-relaxed">
          <p className="font-medium text-[var(--color-text)]">{CONCEPT_CREDIT}.</p>
          <p className="mt-2 text-[var(--color-muted)]">
            Clos &amp; Cadre est une entreprise fictive, créée pour cette démonstration. Ce n&apos;est pas un client, et aucun résultat
            n&apos;est présenté ici : seulement les objectifs pour lesquels le système a été conçu. Dans la démonstration, les réalisations
            sont des exemples ; les preuves (avis, assurances, qualifications, témoignages) restent des emplacements à compléter, jamais
            inventés.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button href={DEMO_BASE_PATH} variant="primary" trackEvent="cta_clicked" trackPayload={{ location: "case_study_open_demo" }}>
            Ouvrir la démonstration →
          </Button>
          <Button href={`${DEMO_BASE_PATH}/projet`} variant="secondary">
            Tester le formulaire de projet
          </Button>
        </div>
      </Section>

      <Section className="pb-8">
        <Link href={DEMO_BASE_PATH} className="group block overflow-hidden rounded-sm border border-[var(--color-border)]">
          <div className="transition-transform duration-700 ease-[var(--ease-signature)] group-hover:scale-[1.01]">
            <Drawing scene="meuliere" state="after" uid="etude-cas" />
          </div>
        </Link>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Planche d&apos;une réalisation de la démonstration. Sur un site réel, elle accompagne les photographies du chantier.
        </p>
      </Section>

      <Section className="py-16">
        <Block number="01" title="Le contexte">
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">
            Avant tout design, nous avons défini l&apos;entreprise comme nous le ferions avec un vrai dirigeant. Tout le reste en découle.
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              ["Métier", BRIEF.trade],
              ["Taille des chantiers", BRIEF.projectSize],
              ["Zone", BRIEF.area],
              ["Client idéal", BRIEF.idealClient],
              ["Projets les plus rentables", BRIEF.mostProfitable],
              ["Spécialités", BRIEF.specialties.join(" · ")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">{label}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[var(--color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block number="02" title="Les problèmes">
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">
            Ce qui empêche la présence digitale d&apos;une entreprise de ce type de convertir correctement — constaté de façon récurrente
            dans le secteur, et que ce concept devait résoudre.
          </p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {PROBLEMS.map((problem) => (
              <li key={problem.title} className="border-t border-[var(--color-border)] pt-5">
                <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{problem.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{problem.text}</p>
              </li>
            ))}
          </ul>
        </Block>

        <Block number="03" title="Notre réflexion">
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">
            Qu&apos;est-ce qui influence la décision d&apos;un propriétaire qui s&apos;apprête à engager l&apos;un des plus gros budgets de sa
            vie ? Ses hésitations, d&apos;abord. Chacune a reçu une réponse précise dans le site.
          </p>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">Ce qui fait hésiter</h3>
              <ul className="mt-4 space-y-3 text-[15px] text-[var(--color-text)]">
                {BRIEF.hesitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Ce qui rassure</h3>
              <ul className="mt-4 space-y-3 text-[15px] text-[var(--color-text)]">
                {BRIEF.proofsNeeded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Ce que l&apos;entreprise doit savoir avant de rappeler
            </h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {BRIEF.beforeCallback.map((item) => (
                <li key={item} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Block>

        <Block number="04" title="Notre réponse">
          <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {RESPONSE.map((item) => (
              <li key={item.title} className="grid gap-3 py-6 sm:grid-cols-[140px_1fr]">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">{item.title}</h3>
                <div>
                  <p className="text-[15px] leading-relaxed text-[var(--color-text)]">{item.text}</p>
                  <Link href={item.link.href} className="mt-3 inline-block text-sm text-[var(--color-muted)] underline decoration-[var(--color-border-strong)] underline-offset-4 hover:text-[var(--color-text)]">
                    {item.link.label} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Block>

        <Block number="05" title="Le parcours">
          <ol className="grid gap-px overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-5">
            {JOURNEY.map((step, index) => (
              <li key={step.stage} className="bg-[var(--color-surface)] p-5">
                <p className="font-display text-xs text-[var(--color-accent)]">0{index + 1}</p>
                <p className="mt-2 font-display text-lg font-semibold">{step.stage}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">{step.where}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">{step.what}</p>
              </li>
            ))}
          </ol>
        </Block>

        <Block number="06" title="Les objectifs">
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">
            Ce que le système a été conçu pour améliorer. Ce sont des objectifs, pas des résultats : ils ne pourront être appelés résultats
            qu&apos;une fois mesurés sur un déploiement réel.
          </p>
          <ul className="mt-6 space-y-4">
            {OBJECTIVES.map((objective) => (
              <li key={objective} className="flex gap-4 text-[15px] leading-relaxed text-[var(--color-text)]">
                <span aria-hidden="true" className="mt-[10px] h-px w-5 shrink-0 bg-[var(--color-accent)]" />
                {objective}
              </li>
            ))}
          </ul>
        </Block>

        <Block number="07" title="Ce que ce projet démontre">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <li key={capability.title} className="border-t border-[var(--color-border)] pt-5">
                <h3 className="font-display text-lg font-semibold">Nous savons {capability.title.toLowerCase()}.</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{capability.text}</p>
              </li>
            ))}
          </ul>
        </Block>

        <Block number="08" title="Pour un déploiement réel">
          <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">
            La structure est prête. Pour passer du concept à un site en production, l&apos;entreprise fournit ce qu&apos;aucune agence ne
            doit inventer :
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TO_PROVIDE.map((item) => (
              <li key={item} className="flex gap-3 text-[15px] text-[var(--color-text)]">
                <span aria-hidden="true" className="text-[var(--color-accent)]">◌</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
            La fiche projet est ensuite branchée sur l&apos;email et le CRM de l&apos;entreprise, et chaque étape du parcours est mesurée
            pour que les objectifs ci-dessus deviennent, un jour, des résultats.
          </p>
        </Block>
      </Section>

      <Section className="pb-28" tone="raised">
        <div className="flex flex-col items-start justify-between gap-8 border-t border-[var(--color-border)] pt-16 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Eyebrow>Entreprises du bâtiment</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Vous dirigez une entreprise de construction ou de rénovation ?
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
              Commençons par analyser ce que votre présence actuelle fait — et ne fait pas — pour vos demandes de chantier.
            </p>
          </div>
          <Button href="/audit" variant="primary" trackEvent="cta_clicked" trackPayload={{ location: "case_study_clos_et_cadre" }}>
            {PRIMARY_CTA_LABEL} →
          </Button>
        </div>
      </Section>
    </>
  );
}
