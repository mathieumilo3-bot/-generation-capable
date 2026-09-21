import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { ARTICLES, getArticleBySlug } from "@/lib/data/articles";

type Props = { params: Promise<{ article: string }> };

const RELATED_LINKS: Record<string, { href: string; label: string }[]> = {
  "prix-creation-site-internet": [
    { href: "/creation-site-internet", label: "Création de site internet" },
    { href: "/solutions/refonte-site-internet", label: "Refonte de site internet" },
  ],
  "comment-etre-visible-sur-google": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/visibilite-google", label: "Visibilité Google" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "seo-local-artisan": [
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
    { href: "/solutions/referencement-local", label: "Référencement local" },
  ],
  "optimiser-google-business-profile": [
    { href: "/solutions/google-business-profile", label: "Optimisation Google Business Profile" },
    { href: "/solutions/referencement-local", label: "SEO local" },
  ],
  "prix-referencement-seo": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "site-internet-artisan-guide": [
    { href: "/solutions/creation-site-artisan", label: "Création de site pour artisan" },
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
  ],
  "generer-demandes-devis-en-ligne": [
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
    { href: "/solutions/landing-page", label: "Landing page" },
    { href: "/solutions/acquisition-artisan", label: "Acquisition artisan" },
  ],
  "refonte-site-seo-erreurs": [
    { href: "/solutions/refonte-site-internet", label: "Refonte de site internet" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "plan-marketing-digital-pme": [
    { href: "/solutions/strategie-marketing-digital", label: "Stratégie marketing digital" },
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
  ],
  "budget-marketing-digital-pme": [
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
    { href: "/solutions/agence-marketing-digital", label: "Agence marketing digital" },
  ],
  "seo-ou-google-ads": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/strategie-marketing-digital", label: "Stratégie marketing digital" },
  ],
  "google-ads-pme-guide": [
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/landing-page", label: "Landing page" },
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
  ],
  "strategie-reseaux-sociaux-entreprise": [
    { href: "/solutions/strategie-reseaux-sociaux", label: "Stratégie réseaux sociaux" },
    { href: "/solutions/content-marketing", label: "Content marketing" },
    { href: "/solutions/publicite-meta-ads", label: "Meta Ads" },
  ],
  "marketing-digital-artisan-guide": [
    { href: "/solutions/marketing-digital-artisan", label: "Marketing digital artisan" },
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
  ],
  "generation-leads-b2b-guide": [
    { href: "/solutions/generation-leads-b2b", label: "Génération de leads B2B" },
    { href: "/solutions/agence-acquisition-b2b", label: "Acquisition B2B" },
    { href: "/solutions/marketing-b2b", label: "Marketing B2B" },
  ],
  "cout-par-lead-qualifie": [
    { href: "/solutions/generation-leads-b2b", label: "Génération de leads B2B" },
    { href: "/solutions/growth-marketing", label: "Growth marketing" },
  ],
  "inbound-ou-outbound-b2b": [
    { href: "/solutions/inbound-marketing", label: "Inbound marketing" },
    { href: "/solutions/marketing-b2b", label: "Marketing B2B" },
    { href: "/solutions/generation-leads-b2b", label: "Lead generation B2B" },
  ],
  "webmarketing-pme-plan": [
    { href: "/solutions/webmarketing", label: "Webmarketing" },
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
  ],
  "growth-marketing-pme": [
    { href: "/solutions/growth-marketing", label: "Growth marketing" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
  ],
  "audit-acquisition-digitale": [
    { href: "/solutions/agence-acquisition-b2b", label: "Acquisition B2B" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
  ],
  "marketing-digital-btp-guide": [
    { href: "/solutions/marketing-digital-btp", label: "Marketing digital BTP" },
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
  ],
  "site-internet-dentiste-seo-local": [
    { href: "/solutions/creation-site-dentiste", label: "Création de site dentiste" },
    { href: "/solutions/marketing-digital-dentiste", label: "Marketing digital dentiste" },
    { href: "/solutions/referencement-local", label: "Référencement local" },
  ],
  "marketing-entreprise-nettoyage-guide": [
    { href: "/solutions/marketing-entreprise-nettoyage", label: "Marketing entreprise de nettoyage" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/generation-leads-b2b", label: "Leads B2B" },
  ],
  "marketing-evenementiel-digital-guide": [
    { href: "/solutions/marketing-evenementiel-digital", label: "Marketing digital événementiel" },
    { href: "/solutions/landing-page", label: "Landing page" },
    { href: "/solutions/publicite-meta-ads", label: "Meta Ads" },
  ],
  "marketing-digital-restaurant-guide": [
    { href: "/solutions/marketing-digital-restaurant", label: "Marketing digital restaurant" },
    { href: "/solutions/google-business-profile", label: "Google Business Profile" },
    { href: "/solutions/marketing-local", label: "Marketing local" },
  ],
  "prix-site-internet-artisan": [
    { href: "/solutions/creation-site-artisan", label: "Création de site pour artisan" },
    { href: "/creation-site-internet", label: "Création de site internet" },
  ],
  "tarif-agence-seo-pme": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
  ],
  "agence-web-ou-freelance": [
    { href: "/creation-site-internet", label: "Création de site internet" },
    { href: "/solutions/site-internet-pme", label: "Site internet PME" },
  ],
  "budget-google-ads-pme": [
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/landing-page", label: "Landing page" },
  ],
  "seo-local-ou-google-ads": [
    { href: "/solutions/referencement-local", label: "Référencement local" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/google-business-profile", label: "Google Business Profile" },
  ],
  "refonte-site-sans-perdre-seo": [
    { href: "/solutions/refonte-site-internet", label: "Refonte de site internet" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
};

const PRIORITY_COMMERCIAL_LINKS: Record<string, { href: string; label: string; description: string }> = {
  "pourquoi-un-beau-site-ne-suffit-plus": {
    href: "/creation-site-internet",
    label: "Création de site internet pour PME et artisans",
    description: "Voir comment structurer un site autour des prestations, des preuves et des demandes.",
  },
  "site-vitrine-ou-systeme-acquisition": {
    href: "/creation-site-internet",
    label: "Créer un site pensé pour générer des demandes",
    description: "Passer d'une simple vitrine à un parcours commercial mesurable.",
  },
  "prix-creation-site-internet": {
    href: "/creation-site-internet",
    label: "Création de site internet",
    description: "Comparer le périmètre utile avant de demander un devis.",
  },
  "site-internet-artisan-guide": {
    href: "/creation-site-internet",
    label: "Création de site internet pour artisans",
    description: "Structurer les pages, les preuves et la demande de devis.",
  },
  "agence-web-ou-freelance": {
    href: "/creation-site-internet",
    label: "Projet de création de site internet",
    description: "Voir les éléments à cadrer avant de choisir un prestataire.",
  },
  "refonte-site-seo-erreurs": {
    href: "/seo",
    label: "SEO pour PME",
    description: "Renforcer les pages existantes sans perdre les signaux déjà acquis.",
  },
  "refonte-site-sans-perdre-seo": {
    href: "/seo",
    label: "Référencement SEO",
    description: "Relier la refonte aux pages et recherches qui génèrent de la visibilité.",
  },
  "comment-etre-visible-sur-google": {
    href: "/seo",
    label: "Agence SEO pour PME",
    description: "Voir la méthode appliquée aux recherches commerciales et aux pages qui comptent.",
  },
  "prix-referencement-seo": {
    href: "/seo",
    label: "Accompagnement SEO",
    description: "Comprendre les priorités avant de répartir un budget SEO.",
  },
  "seo-ou-google-ads": {
    href: "/seo",
    label: "Référencement naturel",
    description: "Construire une visibilité organique sur les recherches à forte intention.",
  },
  "tarif-agence-seo-pme": {
    href: "/seo",
    label: "SEO pour PME",
    description: "Voir ce qu'une stratégie SEO orientée prospects doit réellement travailler.",
  },
  "seo-local-artisan": {
    href: "/solutions/referencement-local",
    label: "Référencement local",
    description: "Relier prestations, zone réelle, Google Business Profile et demande de devis.",
  },
  "optimiser-google-business-profile": {
    href: "/solutions/referencement-local",
    label: "SEO local pour entreprise",
    description: "Faire travailler la fiche Google et les pages du site ensemble.",
  },
  "marketing-digital-artisan-guide": {
    href: "/solutions/referencement-local",
    label: "Référencement local pour artisans",
    description: "Capter les recherches liées au métier, aux prestations et à la zone d'intervention.",
  },
  "site-internet-dentiste-seo-local": {
    href: "/solutions/referencement-local",
    label: "Référencement local",
    description: "Structurer la présence locale autour de pages et informations cohérentes.",
  },
  "marketing-entreprise-nettoyage-guide": {
    href: "/solutions/referencement-local",
    label: "Référencement local",
    description: "Travailler les services et zones réellement couverts pour capter les recherches utiles.",
  },
  "marketing-digital-restaurant-guide": {
    href: "/solutions/referencement-local",
    label: "Visibilité locale sur Google",
    description: "Relier la fiche Google, le site et les recherches locales.",
  },
  "seo-local-ou-google-ads": {
    href: "/solutions/referencement-local",
    label: "Référencement local",
    description: "Construire le socle organique avant de comparer avec l'acquisition payante.",
  },
  "marketing-digital-btp-guide": {
    href: "/solutions/marketing-digital-btp",
    label: "Marketing digital BTP",
    description: "Relier visibilité locale, prestations, réalisations et demandes de devis.",
  },
};

const RELATED_GUIDES: Record<string, string[]> = {
  "prix-creation-site-internet": ["site-internet-artisan-guide", "refonte-site-seo-erreurs"],
  "comment-etre-visible-sur-google": ["prix-referencement-seo", "seo-local-artisan", "optimiser-google-business-profile"],
  "seo-local-artisan": ["comment-etre-visible-sur-google", "optimiser-google-business-profile", "site-internet-artisan-guide"],
  "optimiser-google-business-profile": ["seo-local-artisan", "comment-etre-visible-sur-google"],
  "prix-referencement-seo": ["comment-etre-visible-sur-google", "seo-ou-google-ads", "refonte-site-seo-erreurs"],
  "site-internet-artisan-guide": ["prix-creation-site-internet", "seo-local-artisan", "marketing-digital-artisan-guide"],
  "generer-demandes-devis-en-ligne": ["cout-par-lead-qualifie", "google-ads-pme-guide", "marketing-digital-artisan-guide"],
  "refonte-site-seo-erreurs": ["prix-creation-site-internet", "comment-etre-visible-sur-google"],
  "plan-marketing-digital-pme": ["budget-marketing-digital-pme", "seo-ou-google-ads", "webmarketing-pme-plan"],
  "budget-marketing-digital-pme": ["plan-marketing-digital-pme", "google-ads-pme-guide", "growth-marketing-pme"],
  "seo-ou-google-ads": ["google-ads-pme-guide", "prix-referencement-seo", "comment-etre-visible-sur-google"],
  "google-ads-pme-guide": ["seo-ou-google-ads", "generer-demandes-devis-en-ligne", "budget-marketing-digital-pme"],
  "strategie-reseaux-sociaux-entreprise": ["plan-marketing-digital-pme", "webmarketing-pme-plan", "growth-marketing-pme"],
  "marketing-digital-artisan-guide": ["seo-local-artisan", "site-internet-artisan-guide", "generer-demandes-devis-en-ligne"],
  "generation-leads-b2b-guide": ["cout-par-lead-qualifie", "inbound-ou-outbound-b2b", "audit-acquisition-digitale"],
  "cout-par-lead-qualifie": ["generation-leads-b2b-guide", "audit-acquisition-digitale", "growth-marketing-pme"],
  "inbound-ou-outbound-b2b": ["generation-leads-b2b-guide", "cout-par-lead-qualifie"],
  "webmarketing-pme-plan": ["plan-marketing-digital-pme", "budget-marketing-digital-pme", "growth-marketing-pme"],
  "growth-marketing-pme": ["audit-acquisition-digitale", "webmarketing-pme-plan", "budget-marketing-digital-pme"],
  "audit-acquisition-digitale": ["generation-leads-b2b-guide", "growth-marketing-pme", "plan-marketing-digital-pme"],
  "marketing-digital-btp-guide": ["seo-local-artisan", "generer-demandes-devis-en-ligne", "google-ads-pme-guide"],
  "site-internet-dentiste-seo-local": ["optimiser-google-business-profile", "comment-etre-visible-sur-google", "prix-creation-site-internet"],
  "marketing-entreprise-nettoyage-guide": ["generer-demandes-devis-en-ligne", "google-ads-pme-guide", "seo-local-artisan"],
  "marketing-evenementiel-digital-guide": ["strategie-reseaux-sociaux-entreprise", "plan-marketing-digital-pme", "generer-demandes-devis-en-ligne"],
  "marketing-digital-restaurant-guide": ["optimiser-google-business-profile", "strategie-reseaux-sociaux-entreprise", "seo-local-artisan"],
  "prix-site-internet-artisan": ["site-internet-artisan-guide", "prix-creation-site-internet", "seo-local-artisan"],
  "tarif-agence-seo-pme": ["prix-referencement-seo", "comment-etre-visible-sur-google", "seo-ou-google-ads"],
  "agence-web-ou-freelance": ["prix-creation-site-internet", "refonte-site-seo-erreurs", "plan-marketing-digital-pme"],
  "budget-google-ads-pme": ["google-ads-pme-guide", "seo-ou-google-ads", "cout-par-lead-qualifie"],
  "seo-local-ou-google-ads": ["seo-local-artisan", "optimiser-google-business-profile", "google-ads-pme-guide"],
  "refonte-site-sans-perdre-seo": ["refonte-site-seo-erreurs", "comment-etre-visible-sur-google", "prix-referencement-seo"],
};

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ article: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/ressources/${article.slug}` },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  const relatedLinks = RELATED_LINKS[article.slug] ?? [
    { href: "/solutions", label: "Voir toutes les solutions" },
    { href: "/audit", label: "Analyser mon entreprise" },
  ];
  const relatedGuides = (RELATED_GUIDES[article.slug] ?? [])
    .map((relatedSlug) => getArticleBySlug(relatedSlug))
    .filter(Boolean);
  const priorityCommercialLink = PRIORITY_COMMERCIAL_LINKS[article.slug];

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Ressources", url: `${SITE_URL}/ressources` },
          { name: article.title, url: `${SITE_URL}/ressources/${article.slug}` },
        ]}
      />
      <ArticleJsonLd
        title={article.title}
        description={article.excerpt}
        url={`${SITE_URL}/ressources/${article.slug}`}
        datePublished={article.publishedAt}
      />

      <article className="mx-auto max-w-2xl">
        <Eyebrow>{article.readingTime} de lecture</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {article.title}
        </h1>

        <div className="mt-10 flex flex-col gap-6">
          {article.content.map((paragraph, index) => (
            <div key={index}>
              <p className="text-[16px] leading-relaxed text-[var(--color-muted)]">
                {paragraph}
              </p>
              {index === 1 && priorityCommercialLink && (
                <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    À approfondir
                  </p>
                  <Link
                    href={priorityCommercialLink.href}
                    className="font-display mt-2 block text-base font-semibold text-[var(--color-text)] underline decoration-[var(--color-accent)] underline-offset-4"
                  >
                    {priorityCommercialLink.label} →
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                    {priorityCommercialLink.description}
                  </p>
                </div>
              )}
              {index === 2 && (
                <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <p className="font-display text-base font-semibold text-[var(--color-text)]">
                    Vous voulez savoir où votre site perd des opportunités ?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                    Lancez le diagnostic GC Agence : visibilité, conversion, acquisition et priorités d&apos;action.
                  </p>
                  <Link
                    href="/audit"
                    className="mt-4 inline-flex text-sm font-semibold text-[var(--color-text)] underline decoration-[var(--color-accent)] underline-offset-4"
                  >
                    Analyser mon entreprise →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-[var(--color-border)] pt-10">
          <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">À explorer ensuite</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {relatedGuides.length > 0 && (
          <section className="mt-10 border-t border-[var(--color-border)] pt-10">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              Guides complémentaires
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {relatedGuides.map((guide) =>
                guide ? (
                  <Link
                    key={guide.slug}
                    href={`/ressources/${guide.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]"
                  >
                    <p className="font-display text-base font-semibold text-[var(--color-text)]">
                      {guide.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      {guide.excerpt}
                    </p>
                  </Link>
                ) : null
              )}
            </div>
          </section>
        )}

        <div className="mt-10 border-t border-[var(--color-border)] pt-10">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: `article_${article.slug}` }}
          >
            {PRIMARY_CTA_LABEL} →
          </Button>
        </div>
      </article>
    </Section>
  );
}
