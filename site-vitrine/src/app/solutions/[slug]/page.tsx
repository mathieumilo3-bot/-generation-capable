import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ServiceJsonLd,
} from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { CALENDLY_URL } from "@/lib/booking";
import {
  getSeoLandingBySlug,
  SEO_LANDINGS,
} from "@/lib/data/seo-landings";
import { getArticleBySlug } from "@/lib/data/articles";

type Props = { params: Promise<{ slug: string }> };

type CommercialEnhancement = {
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  extraBlocks: { heading: string; body: string }[];
  proofNote: string;
};

const COMMERCIAL_ENHANCEMENTS: Record<string, CommercialEnhancement> = {
  "audit-seo": {
    title: "Audit SEO : diagnostic priorisé pour PME",
    metaDescription:
      "Audit SEO pour PME : technique, pages, requêtes, maillage et conversion. Identifiez les corrections prioritaires pour gagner en visibilité utile et en demandes.",
    h1: "Audit SEO : savoir quoi corriger en premier pour gagner en visibilité et en demandes.",
    intro:
      "Un audit SEO utile doit déboucher sur des décisions. Nous relions les problèmes techniques, les pages déjà visibles, les intentions commerciales, le contenu et le parcours de conversion afin de prioriser les actions qui peuvent réellement servir l'acquisition.",
    extraBlocks: [
      {
        heading: "Partir des pages et requêtes qui ont déjà un potentiel",
        body:
          "Avant de créer du contenu supplémentaire, nous regardons quelles pages correspondent déjà à des recherches utiles, lesquelles sont trop faibles et quelles intentions commerciales n'ont aucune destination claire. L'objectif est d'améliorer ce qui peut produire une demande, pas de poursuivre un score abstrait.",
      },
      {
        heading: "Trier les problèmes par impact et par effort",
        body:
          "Indexation, titles, contenu, maillage, duplication, performance, données structurées ou pages manquantes n'ont pas tous la même urgence. Le plan distingue les corrections bloquantes, les gains rapides et les chantiers qui demandent davantage de contenu ou d'autorité.",
      },
      {
        heading: "Transformer l'audit en feuille de route",
        body:
          "Chaque recommandation doit indiquer la page concernée, la raison, l'action attendue et la manière de vérifier le résultat. Le livrable sert à exécuter : corriger, publier, mesurer puis réévaluer.",
      },
      {
        heading: "Relier SEO et demandes commerciales",
        body:
          "Les impressions et clics ne suffisent pas. Les pages prioritaires sont celles qui peuvent conduire vers un devis, un appel ou un rendez-vous qualifié. Le suivi doit ensuite rapprocher visibilité, trafic et conversions réelles.",
      },
    ],
    proofNote:
      "Aucune position n'est promise à l'issue d'un audit. Les progrès doivent être vérifiés après mise en œuvre avec les données réelles du site, notamment Search Console lorsqu'elles sont disponibles.",
  },
  "google-business-profile": {
    title: "Agence Google Business Profile : visibilité locale & appels",
    metaDescription:
      "Optimisation Google Business Profile : catégories, services, avis, photos, pages liées et suivi pour transformer les recherches locales en appels et demandes.",
    h1: "Google Business Profile : transformer votre présence locale en appels et demandes.",
    intro:
      "Une fiche Google locale performante doit être cohérente avec les services réellement vendus, le site, les zones couvertes et les preuves visibles. L'objectif n'est pas de remplir chaque champ : c'est d'aider un prospect local à vous choisir puis à agir.",
    extraBlocks: [
      {
        heading: "Aligner catégories, services et pages du site",
        body:
          "La catégorie principale, les services et la page liée doivent décrire la même activité. Pour les prestations importantes, le site doit proposer une page claire qui détaille le besoin, les preuves et la prochaine étape.",
      },
      {
        heading: "Renforcer la confiance avec des preuves réelles",
        body:
          "Photos de réalisations, équipe, locaux lorsqu'ils existent, avis clients vérifiables et réponses utiles réduisent l'incertitude. Nous n'ajoutons ni avis fabriqués ni adresse artificielle pour tenter d'élargir une zone.",
      },
      {
        heading: "Optimiser le parcours après la fiche",
        body:
          "Un clic vers le site doit conduire vers une page adaptée au besoin, avec appel, devis ou rendez-vous visible sur mobile. La cohérence fiche → page → action est plus utile qu'un simple renvoi vers une page d'accueil générique.",
      },
      {
        heading: "Mesurer les actions locales",
        body:
          "Appels, clics vers le site, itinéraires, formulaires et rendez-vous permettent de comprendre ce que la présence locale génère réellement. Ces signaux doivent guider les prochaines optimisations.",
      },
    ],
    proofNote:
      "Nous ne créons pas de faux avis, de fausses adresses ni de fausses zones d'implantation. La visibilité locale dépend aussi de la pertinence, de la distance et de la notoriété ; aucune place fixe sur Maps n'est garantie.",
  },
  "generation-de-leads": {
    title: "Agence génération de leads : acquisition & rendez-vous qualifiés",
    metaDescription:
      "Génération de leads pour PME : ciblage, SEO, Ads, landing pages, qualification et suivi jusqu'au rendez-vous ou à la demande de devis.",
    h1: "Agence de génération de leads : transformer l'acquisition en demandes réellement qualifiées.",
    intro:
      "Un lead n'a de valeur que s'il correspond à votre cible, comprend l'offre et peut avancer commercialement. Nous relions acquisition, page d'arrivée, qualification et prise de rendez-vous pour éviter d'optimiser uniquement le volume de formulaires.",
    extraBlocks: [
      {
        heading: "Définir ce qu'est un lead utile avant d'acheter du trafic",
        body:
          "Secteur, besoin, zone, budget, délai ou taille d'entreprise peuvent changer la qualité d'une opportunité. Nous définissons les critères réellement discriminants avant de choisir les canaux et le formulaire.",
      },
      {
        heading: "Faire correspondre chaque source à une page précise",
        body:
          "Une recherche Google, une annonce ou un contenu ne doivent pas tomber sur une page générique. La page reprend le besoin initial, répond aux objections, montre les preuves disponibles et conduit vers une action unique.",
      },
      {
        heading: "Qualifier sans tuer la conversion",
        body:
          "Le formulaire demande seulement les informations nécessaires à la prochaine étape. Pour un prospect déjà mûr, la prise de rendez-vous reste accessible sans multiplier les écrans inutiles.",
      },
      {
        heading: "Optimiser sur les opportunités, pas sur les formulaires",
        body:
          "Le coût par lead brut peut être trompeur. Le suivi doit distinguer demandes valides, rendez-vous tenus, opportunités commerciales et ventes afin de renforcer les sources qui produisent réellement du chiffre d'affaires.",
      },
    ],
    proofNote:
      "GC ne présente pas un volume de leads ou un coût par lead comme garanti. Les performances dépendent de l'offre, du marché, du budget, de la concurrence et du traitement commercial des demandes.",
  },
  "publicite-google-ads": {
    title: "Agence Google Ads PME : campagnes orientées leads",
    metaDescription:
      "Agence Google Ads pour PME : mots-clés à forte intention, landing pages, exclusions, suivi des conversions et optimisation vers les demandes qualifiées.",
    h1: "Agence Google Ads pour PME : capter les recherches prêtes à passer à l'action.",
    intro:
      "Google Ads peut accélérer l'acquisition quand une personne cherche déjà un service, un devis ou une solution. La rentabilité dépend cependant autant du ciblage et des exclusions que de la page d'arrivée, du suivi et de la qualité commerciale des demandes.",
    extraBlocks: [
      {
        heading: "Concentrer le budget sur les intentions commerciales",
        body:
          "Les campagnes doivent séparer les recherches proches d'une décision des requêtes trop générales ou informatives. Les mots-clés négatifs et les rapports de termes de recherche servent à réduire progressivement le trafic sans valeur.",
      },
      {
        heading: "Envoyer chaque recherche vers la bonne landing page",
        body:
          "L'annonce et la page doivent parler du même service. Le prospect doit retrouver immédiatement la promesse, les preuves disponibles, les objections principales et un formulaire ou rendez-vous adapté.",
      },
      {
        heading: "Suivre les conversions qui comptent",
        body:
          "Formulaires, appels et rendez-vous doivent être mesurés séparément lorsque c'est possible. Le pilotage devient plus pertinent quand les retours commerciaux permettent de distinguer un simple contact d'une opportunité réelle.",
      },
      {
        heading: "Décider avec un budget test explicite",
        body:
          "Avant d'augmenter les dépenses, il faut définir la zone, les services, le budget test, la valeur d'une opportunité et les critères d'arrêt ou d'augmentation. Une campagne ne doit pas continuer uniquement parce qu'elle génère des clics.",
      },
    ],
    proofNote:
      "Le coût par clic, le coût par lead et le volume de demandes varient selon le marché, la zone, l'offre et la concurrence. Aucun coût d'acquisition ni volume de leads n'est garanti avant d'avoir des données réelles.",
  },
  "generation-leads-b2b": {
    title: "Agence génération de leads B2B : rendez-vous qualifiés",
    metaDescription:
      "Génération de leads B2B : ciblage ICP, SEO, Google Ads, landing pages, qualification et rendez-vous pour alimenter un pipeline commercial mesurable.",
    h1: "Agence de génération de leads B2B : alimenter le pipeline avec des opportunités qualifiées.",
    intro:
      "En B2B, un formulaire ne vaut pas un projet. Le système doit viser les bons comptes, capter ou créer une intention, qualifier le besoin puis transmettre aux commerciaux un contexte exploitable pour le rendez-vous.",
    extraBlocks: [
      {
        heading: "Définir l'ICP et les signaux de qualification",
        body:
          "Secteur, taille, fonction, zone, problème, échéance ou équipement existant peuvent permettre de distinguer un compte cible d'un contact hors sujet. Ces critères structurent les campagnes, les contenus et la qualification.",
      },
      {
        heading: "Combiner acquisition et conversion",
        body:
          "SEO, Google Ads, contenus ou prospection peuvent nourrir le même parcours. La page d'arrivée doit être cohérente avec l'intention et proposer une prochaine étape proportionnée à la maturité du prospect.",
      },
      {
        heading: "Préparer le rendez-vous commercial",
        body:
          "La qualification doit faire remonter les informations utiles au closer : contexte, besoin, objectif, délai et éventuelles contraintes. Le but n'est pas d'ajouter des champs, mais d'améliorer la qualité de la conversation.",
      },
      {
        heading: "Mesurer jusqu'au pipeline",
        body:
          "Leads marketing, rendez-vous, opportunités et ventes ne sont pas interchangeables. Le suivi doit permettre de revenir jusqu'à la source et à la page qui ont généré les meilleures opportunités.",
      },
    ],
    proofNote:
      "Nous ne présentons pas de rendez-vous, de taux de conversion ou de chiffre d'affaires comme garantis. Les performances dépendent du marché, de l'offre, du ciblage, du budget et de l'exécution commerciale.",
  },
  "referencement-local": {
    title: "Agence SEO local : référencement local pour entreprises",
    metaDescription:
      "Agence SEO local pour artisans, TPE et entreprises de services : pages de prestations, Google Business Profile, preuves locales et parcours vers le devis.",
    h1: "Agence SEO local : être trouvé par les clients qui cherchent votre service dans votre zone.",
    intro:
      "Le référencement local doit capter une intention commerciale réelle : un service, un besoin et une zone que votre entreprise sert vraiment. Nous relions pages de prestations, Google Business Profile, preuves locales et parcours de contact pour transformer cette visibilité en demandes.",
    extraBlocks: [
      {
        heading: "Couvrir les recherches locales qui peuvent déclencher un devis",
        body:
          "Les priorités viennent des services réellement vendus : métier + zone, prestation + ville, demande de devis, urgence ou besoin précis. Nous évitons de viser des communes sans contenu spécifique ni réalité commerciale.",
      },
      {
        heading: "Renforcer les preuves locales avant d'ajouter des pages",
        body:
          "Photos réelles, réalisations situées, avis vérifiables, certifications, coordonnées et zones d'intervention cohérentes renforcent la confiance. Quand une preuve n'existe pas, elle n'est pas inventée pour remplir une page.",
      },
      {
        heading: "Faire du clic local une demande exploitable",
        body:
          "La page doit permettre d'appeler, demander un devis ou réserver un échange rapidement sur mobile. Le formulaire demande uniquement les informations qui changent réellement la suite commerciale.",
      },
    ],
    proofNote:
      "GC n'utilise pas de faux avis, de fausses implantations ni de résultats de classement inventés. Une amélioration publiée est distinguée d'une progression réellement observée dans les données.",
  },
  "marketing-digital-btp": {
    title: "Agence marketing digital BTP : SEO, site & demandes de devis",
    metaDescription:
      "Agence marketing digital BTP : site, SEO local, Google Business, Google Ads et parcours de devis pour artisans et entreprises du bâtiment.",
    h1: "Agence marketing digital BTP : transformer les recherches locales en demandes de devis.",
    intro:
      "Dans le bâtiment, un prospect compare une prestation, une zone, des réalisations et la capacité de l'entreprise à prendre en charge son chantier. Le dispositif digital doit rendre ces éléments visibles puis conduire vers une demande de devis qualifiée.",
    extraBlocks: [
      {
        heading: "Prioriser les recherches BTP proches d'un projet",
        body:
          "Nous travaillons d'abord les intentions liées aux prestations rentables : rénovation, couverture, isolation, maçonnerie, menuiserie ou autre service réellement proposé, puis les zones d'intervention réellement couvertes.",
      },
      {
        heading: "Montrer des preuves chantier vérifiables",
        body:
          "Photos avant/après, type de chantier, zone, certifications, garanties et réalisations réelles rassurent mieux qu'un discours générique. Aucun chantier, avis ou résultat n'est créé artificiellement pour la page.",
      },
      {
        heading: "Qualifier le devis sans bloquer le prospect",
        body:
          "Type de travaux, localisation, délai, surface ou photos éventuelles peuvent préparer le rendez-vous. Le formulaire reste court et l'accès au rendez-vous reste visible pour les projets déjà mûrs.",
      },
    ],
    proofNote:
      "Le SEO, Google Business Profile et les campagnes peuvent améliorer la visibilité, mais aucune position ni volume de devis n'est garanti. Les gains sont présentés seulement lorsqu'ils sont mesurés.",
  },
};

const RELATED_ARTICLES: Record<string, string[]> = {
  "audit-site-internet": ["refonte-site-seo-erreurs", "prix-creation-site-internet"],
  "audit-seo": ["comment-etre-visible-sur-google", "prix-referencement-seo", "refonte-site-seo-erreurs"],
  "referencement-local": ["seo-local-artisan", "optimiser-google-business-profile", "seo-local-ou-google-ads"],
  "google-business-profile": ["optimiser-google-business-profile", "seo-local-artisan"],
  "visibilite-google": ["comment-etre-visible-sur-google", "prix-referencement-seo", "seo-local-artisan"],
  "landing-page": ["generer-demandes-devis-en-ligne", "google-ads-pme-guide"],
  "tunnel-de-vente": ["generer-demandes-devis-en-ligne", "cout-par-lead-qualifie"],
  "refonte-site-internet": ["refonte-site-seo-erreurs", "refonte-site-sans-perdre-seo", "prix-creation-site-internet"],
  "site-internet-pme": ["prix-creation-site-internet", "agence-web-ou-freelance", "plan-marketing-digital-pme"],

  "agence-marketing-digital": ["plan-marketing-digital-pme", "budget-marketing-digital-pme"],
  "strategie-marketing-digital": ["plan-marketing-digital-pme", "webmarketing-pme-plan"],
  "marketing-digital-pme": ["budget-marketing-digital-pme", "plan-marketing-digital-pme", "tarif-agence-seo-pme"],
  "audit-marketing-digital": ["audit-acquisition-digitale", "comment-etre-visible-sur-google"],
  "marketing-local": ["seo-local-artisan", "optimiser-google-business-profile"],
  "publicite-google-ads": ["google-ads-pme-guide", "seo-ou-google-ads", "budget-google-ads-pme"],
  "publicite-meta-ads": ["strategie-reseaux-sociaux-entreprise", "budget-marketing-digital-pme"],
  "strategie-reseaux-sociaux": ["strategie-reseaux-sociaux-entreprise", "webmarketing-pme-plan"],
  "content-marketing": ["comment-etre-visible-sur-google", "strategie-reseaux-sociaux-entreprise"],
  "marketing-digital-artisan": ["marketing-digital-artisan-guide", "seo-local-artisan"],
  "generation-leads-b2b": ["generation-leads-b2b-guide", "cout-par-lead-qualifie", "inbound-ou-outbound-b2b"],
  "agence-acquisition-b2b": ["generation-leads-b2b-guide", "audit-acquisition-digitale"],
  "marketing-b2b": ["inbound-ou-outbound-b2b", "generation-leads-b2b-guide"],
  "growth-marketing": ["growth-marketing-pme", "audit-acquisition-digitale"],
  "webmarketing": ["webmarketing-pme-plan", "budget-marketing-digital-pme"],
  "communication-digitale": ["strategie-reseaux-sociaux-entreprise", "webmarketing-pme-plan"],
  "inbound-marketing": ["inbound-ou-outbound-b2b", "generation-leads-b2b-guide"],
  "consultant-marketing-digital": ["audit-acquisition-digitale", "plan-marketing-digital-pme"],
  "generation-de-leads": ["generer-demandes-devis-en-ligne", "cout-par-lead-qualifie"],
  "referencement-artisan": ["seo-local-artisan", "site-internet-artisan-guide"],
  "creation-site-artisan": ["site-internet-artisan-guide", "prix-creation-site-internet", "prix-site-internet-artisan"],
  "marketing-digital-btp": ["marketing-digital-btp-guide", "seo-local-artisan"],
  "creation-site-dentiste": ["site-internet-dentiste-seo-local", "comment-etre-visible-sur-google"],
  "marketing-digital-dentiste": ["site-internet-dentiste-seo-local", "optimiser-google-business-profile"],
  "marketing-entreprise-nettoyage": ["marketing-entreprise-nettoyage-guide", "generer-demandes-devis-en-ligne"],
  "marketing-evenementiel-digital": ["marketing-evenementiel-digital-guide", "strategie-reseaux-sociaux-entreprise"],
  "marketing-digital-restaurant": ["marketing-digital-restaurant-guide", "optimiser-google-business-profile"],
};

function bookingUrlFor(slug: string) {
  return `${CALENDLY_URL}?utm_source=gc_agence&utm_medium=website&utm_campaign=seo_commercial&utm_content=${encodeURIComponent(
    slug
  )}`;
}

export function generateStaticParams() {
  return SEO_LANDINGS.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoLandingBySlug(slug);
  if (!page) return {};

  const enhancement = COMMERCIAL_ENHANCEMENTS[page.slug];
  const title = enhancement?.title ?? page.title;
  const description = enhancement?.metaDescription ?? page.metaDescription;

  return {
    title,
    description,
    alternates: { canonical: `/solutions/${page.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/solutions/${page.slug}`,
      type: "website",
    },
  };
}

export default async function SeoLandingPage({ params }: Props) {
  const { slug } = await params;
  const page = getSeoLandingBySlug(slug);
  if (!page) notFound();

  const enhancement = COMMERCIAL_ENHANCEMENTS[page.slug];
  const pageH1 = enhancement?.h1 ?? page.h1;
  const pageIntro = enhancement?.intro ?? page.intro;
  const pageDescription = enhancement?.metaDescription ?? page.metaDescription;
  const blocks = [...page.blocks, ...(enhancement?.extraBlocks ?? [])];
  const related = page.related
    .map((relatedSlug) => getSeoLandingBySlug(relatedSlug))
    .filter(Boolean);
  const relatedArticles = (RELATED_ARTICLES[page.slug] ?? [])
    .map((articleSlug) => getArticleBySlug(articleSlug))
    .filter(Boolean);

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Solutions", url: `${SITE_URL}/solutions` },
          { name: pageH1, url: `${SITE_URL}/solutions/${page.slug}` },
        ]}
      />
      <ServiceJsonLd
        name={pageH1}
        description={pageDescription}
        url={`${SITE_URL}/solutions/${page.slug}`}
      />
      <FAQJsonLd items={page.faqs} />

      <div className="mx-auto max-w-3xl">
        <Eyebrow>{page.eyebrow}</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {pageH1}
        </h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
          {pageIntro}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: `seo_landing_top_${page.slug}` }}
          >
            Analyser mon entreprise →
          </Button>
          {enhancement && (
            <Button
              href={bookingUrlFor(page.slug)}
              variant="secondary"
              target="_blank"
              rel="noopener noreferrer"
              trackEvent="cta_clicked"
              trackPayload={{ location: `seo_landing_top_booking_${page.slug}` }}
            >
              Parler de mon projet →
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Diagnostic initial · Sans engagement
        </p>

        <div className="mt-14 flex flex-col gap-10">
          {blocks.map((block, index) => (
            <div key={block.heading}>
              <section>
                <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
                  {block.heading}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {block.body}
                </p>
              </section>

              {index === 1 && (
                <div className="mt-9 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-base font-semibold text-[var(--color-text)]">
                      Vous voulez savoir ce qui bloque chez vous ?
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                      On analyse votre situation avant de vous recommander quoi que ce soit.
                    </p>
                  </div>
                  <Button
                    href="/audit"
                    variant="secondary"
                    trackEvent="cta_clicked"
                    trackPayload={{ location: `seo_landing_inline_${page.slug}` }}
                  >
                    Voir mes priorités →
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {enhancement && (
          <section className="mt-14 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
              Une méthode vérifiable avant de parler de résultats
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
              {enhancement.proofNote}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                href="/audit"
                variant="primary"
                trackEvent="cta_clicked"
                trackPayload={{ location: `seo_landing_proof_${page.slug}` }}
              >
                Recevoir mon diagnostic →
              </Button>
              <Button
                href={bookingUrlFor(page.slug)}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="cta_clicked"
                trackPayload={{ location: `seo_landing_booking_${page.slug}` }}
              >
                Réserver un échange de 30 min →
              </Button>
            </div>
          </section>
        )}

        <div className="mt-14 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="font-display text-lg font-semibold text-[var(--color-text)]">
            Vous voulez savoir si ce levier est prioritaire pour votre entreprise ?
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            Le diagnostic analyse votre situation avant de recommander les pages, canaux et corrections à traiter en premier.
          </p>
          <Button
            href="/audit"
            variant="secondary"
            trackEvent="cta_clicked"
            trackPayload={{ location: `seo_landing_mid_${page.slug}` }}
            className="mt-5"
          >
            Analyser mon entreprise →
          </Button>
        </div>

        <section className="mt-16 border-t border-[var(--color-border)] pt-12">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
            Questions fréquentes
          </h2>
          <div className="mt-6 divide-y divide-[var(--color-border)]">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-[var(--color-text)]">
                  {faq.question}
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              À explorer ensuite
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {related.map((item) =>
                item ? (
                  <Link
                    key={item.slug}
                    href={`/solutions/${item.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
                  >
                    {item.title}
                  </Link>
                ) : null
              )}
            </div>
          </section>
        )}

        {relatedArticles.length > 0 && (
          <section className="mt-16 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              Guides liés à ce sujet
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {relatedArticles.map((article) =>
                article ? (
                  <Link
                    key={article.slug}
                    href={`/ressources/${article.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]"
                  >
                    <p className="font-display text-base font-semibold text-[var(--color-text)]">
                      {article.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      {article.excerpt}
                    </p>
                  </Link>
                ) : null
              )}
            </div>
          </section>
        )}

        <div className="mt-16 border-t border-[var(--color-border)] pt-10">
          <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            Vous voulez savoir quelles corrections et quelles pages ont le plus de potentiel pour votre entreprise ? Lancez le diagnostic et partez de votre situation réelle.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: `seo_landing_${page.slug}` }}
            >
              {PRIMARY_CTA_LABEL} →
            </Button>
            {enhancement && (
              <Button
                href={bookingUrlFor(page.slug)}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="cta_clicked"
                trackPayload={{ location: `seo_landing_bottom_booking_${page.slug}` }}
              >
                Réserver 30 min →
              </Button>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
