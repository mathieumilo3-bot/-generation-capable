import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/data/legal";

function Script({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: LEGAL_ENTITY.denomination,
        alternateName: ["GC", "Agence GC"],
        url: SITE_URL,
        sameAs: [
          "https://www.pappers.fr/entreprise/le-dorven-enzo-981319957",
          "https://www.societe.com/societe/monsieur-enzo-le-dorven-981319957.html",
        ],
        description: SITE_DESCRIPTION,
        logo: `${SITE_URL}/apple-icon`,
        email: LEGAL_ENTITY.email,
        identifier: {
          "@type": "PropertyValue",
          propertyID: "SIREN",
          value: LEGAL_ENTITY.siren,
        },
        founder: {
          "@type": "Person",
          name: LEGAL_ENTITY.directeurPublication,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "2 rue Anita Conti",
          postalCode: "56300",
          addressLocality: "Pontivy",
          addressCountry: "FR",
        },
        areaServed: "FR",
        knowsAbout: [
          "Création de site internet",
          "Référencement naturel SEO",
          "Référencement local",
          "Marketing digital",
          "Génération de leads",
          "Google Ads",
          "Acquisition B2B",
        ],
      }}
    />
  );
}

export function WebSiteJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#organization` },
        url: SITE_URL,
        inLanguage: "fr-FR",
      }}
    />
  );
}

export function ServiceJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: name,
        description,
        url,
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: "FR",
      }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  url,
  datePublished,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        url,
        mainEntityOfPage: url,
        datePublished,
        dateModified: datePublished,
        author: {
          "@type": "Organization",
          name: SITE_NAME,
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}


export function FAQJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}


export function ItemListJsonLd({
  name,
  items,
}: {
  name: string;
  items: { name: string; url: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          url: item.url,
        })),
      }}
    />
  );
}
