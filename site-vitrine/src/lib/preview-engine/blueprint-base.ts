import type { BlueprintSection, PreviewBlueprint, SectionType } from "./blueprint-schema";
import { TRADE_FAMILIES, type ProofKind } from "./trades";
import type { PortfolioAsset, VerifiedCompanyProfile } from "./types";

/**
 * The deterministic blueprint: the floor every preview can fall back to,
 * field by field. It is built only from the verified profile, with sober
 * copy that states what is known and nothing else. The model may improve on
 * it; it can never go below it.
 */

function lowerFirst(value: string): string {
  return value && value.charAt(0) !== value.charAt(0).toUpperCase() ? value : value.charAt(0).toLowerCase() + value.slice(1);
}

function firstSentence(text: string, max = 190): string {
  const sentence = text.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? text;
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** Trims to `max` characters on a word boundary. */
export function fit(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/[\s,;:–-]+\S*$/, "").trim() + "…";
}

function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** Photos good enough to carry a section: real site photos, big enough when size is known. */
export function usableAssets(profile: VerifiedCompanyProfile): PortfolioAsset[] {
  return profile.portfolioAssets.filter((asset) => !asset.width || asset.width >= 480);
}

export function buildBaseBlueprint(profile: VerifiedCompanyProfile): PreviewBlueprint {
  const family = TRADE_FAMILIES[profile.identity.tradeFamily];
  const name = profile.identity.publicName.value;
  const trade = profile.identity.trade.value;
  const city = profile.identity.city?.value;
  const phone = profile.contacts.phone?.value;
  const assets = usableAssets(profile);
  const services = profile.services.slice(0, 6);
  const observedServices = services.filter((s) => s.confidence === "observed");

  const templateFamily: PreviewBlueprint["templateFamily"] = assets.length >= 3 ? "project" : city ? "local" : "editorial";
  const heroImage = templateFamily === "project" ? assets.find((a) => a.type === "realisation") ?? assets[0] : undefined;
  const heroVariant = heroImage ? "HeroProject" : templateFamily === "local" ? "HeroLocal" : "HeroEditorial";

  const serviceNames = services.slice(0, 3).map((s) => lowerFirst(s.name));
  const subheadline = serviceNames.length
    ? `${serviceNames.length > 1 ? listOf(serviceNames) : serviceNames[0]}. Décrivez votre projet et recevez votre devis.`
    : "Décrivez votre projet et recevez votre devis.";

  const trustIds = profile.trust.items.filter((t) => t.kind !== "registry").map((t) => t.id).slice(0, 4);
  const reviewIds = profile.reviews.map((r) => r.id).slice(0, 2);
  const proofStrategy: PreviewBlueprint["proof"]["strategy"] = reviewIds.length
    ? "reviews"
    : trustIds.length
      ? "labels"
      : assets.length >= 3
        ? "portfolio"
        : profile.identity.siren
          ? "registry"
          : "none";

  // --- why: one point per verified fact, strongest first ---------------------
  const why: PreviewBlueprint["why"]["points"] = [];
  for (const item of profile.trust.items) {
    if (why.length >= 3) break;
    if (item.kind === "certification") why.push({ title: fit(item.label, 48), body: `Qualification ${item.label} mentionnée par l’entreprise.`, factRef: item.id });
    if (item.kind === "insurance") why.push({ title: "Assurance décennale", body: "Assurance décennale mentionnée par l’entreprise.", factRef: item.id });
  }
  if (profile.trust.experienceQuote && why.length < 4) {
    why.push({ title: "Savoir-faire", body: `« ${firstSentence(profile.trust.experienceQuote.value, 170)} »`, factRef: "experience" });
  } else if (profile.identity.foundedYear && why.length < 4) {
    why.push({ title: `Depuis ${profile.identity.foundedYear.value}`, body: `Entreprise immatriculée en ${profile.identity.foundedYear.value}.`, factRef: "founded" });
  }
  if (phone && why.length < 4) why.push({ title: "Un interlocuteur direct", body: `Un appel au ${phone} suffit pour parler de votre projet.`, factRef: "phone" });
  if (city && why.length < 4) why.push({ title: fit(`Basée à ${city}`, 48), body: `Une entreprise locale, joignable pour vos travaux à ${city}.`, factRef: "city" });
  if (why.length === 0) why.push({ title: "Un devis clair", body: "Chaque demande part de votre projet, décrit en quelques lignes.", factRef: "quote" });
  // A "why" section that only repeats the registry facts of the trust strip adds nothing.
  const whyHasSubstance = why.some((p) => !["founded", "city", "quote"].includes(p.factRef));

  // --- sections, ordered by what convinces first in this trade ----------------
  const available: Partial<Record<SectionType, BlueprintSection>> = {
    ...(trustIds.length || reviewIds.length || profile.identity.siren ? { trust: { type: "trust", variant: "TrustStrip" } } : {}),
    ...(services.length
      ? { services: { type: "services", variant: services.length >= 4 ? "ServicesGrid" : services.length >= 2 ? "ServicesEditorial" : "ServiceSpotlight" } }
      : {}),
    ...(assets.length >= 2 ? { portfolio: { type: "portfolio", variant: assets.length >= 5 ? "PortfolioGrid" : "PortfolioFeature" } } : {}),
    ...(whyHasSubstance ? { why: { type: "why", variant: "WhyCompany" } } : {}),
    ...(city || profile.areas.zoneQuote ? { area: { type: "area", variant: "AreaLocal" } } : {}),
    ...(profile.presence.level === "C" || (!assets.length && profile.identity.foundedYear) ? { about: { type: "about", variant: "AboutCompany" } } : {}),
    cta: { type: "cta", variant: "CtaQuote" },
  };
  const proofSections: Record<ProofKind, SectionType[]> = { portfolio: ["portfolio"], labels: ["why"], reviews: ["why"] };
  const middle = [...new Set(family.proofOrder.flatMap((kind) => proofSections[kind]))];
  const order: SectionType[] = ["trust", "services", ...middle, "about", "area", "cta"];
  const sections = [...new Set(order)].map((type) => available[type]).filter(Boolean) as BlueprintSection[];

  const aboutParts = [
    `${name} est une entreprise ${city ? `basée à ${city}` : "du bâtiment"}${profile.identity.foundedYear ? `, immatriculée en ${profile.identity.foundedYear.value}` : ""}.`,
    services.length ? `Activité : ${listOf(services.slice(0, 3).map((s) => lowerFirst(s.name)))}.` : "",
  ].filter(Boolean);

  return {
    version: 1,
    templateFamily,
    hero: {
      variant: heroVariant,
      eyebrow: fit(city ? `${trade} · ${city}` : trade, 64),
      headline: fit(city ? `${trade} à ${city}` : name, 90),
      subheadline: firstSentence(subheadline.charAt(0).toUpperCase() + subheadline.slice(1), 200),
      imageAssetId: heroImage?.id ?? null,
    },
    primaryCta: { label: "Demander un devis" },
    secondaryCta: phone ? { label: "Appeler" } : null,
    sections,
    services: {
      heading: observedServices.length ? "Nos prestations" : "Notre métier",
      intro: null,
      items: (services.length ? services : []).map((service) => ({
        serviceId: service.id,
        title: fit(service.name, 60),
        description: service.quote ? `« ${firstSentence(service.quote, 184)} »` : null,
      })),
    },
    proof: { strategy: proofStrategy, trustIds, reviewIds },
    portfolio: {
      heading: assets.some((a) => a.type === "realisation") ? "Nos réalisations" : "En images",
      assetIds: assets.slice(0, 7).map((a) => a.id),
    },
    why: { heading: name.length <= 44 ? `Pourquoi choisir ${name}` : "Pourquoi nous choisir", points: why.slice(0, 4) },
    area: city || profile.areas.zoneQuote
      ? {
          heading: profile.areas.zoneQuote ? "Zone d’intervention" : fit(`Basée à ${city}`, 70),
          body: profile.areas.zoneQuote
            ? `« ${firstSentence(profile.areas.zoneQuote.value, 234)} »`
            : "Indiquez l’adresse du chantier dans votre demande : nous vous confirmons si elle est dans notre secteur.",
        }
      : null,
    about: { heading: name.length <= 55 ? `À propos de ${name}` : "À propos", body: fit(aboutParts.join(" "), 420) },
    finalCta: {
      heading: "Un projet ? Parlons-en.",
      body: phone ? `Décrivez vos travaux en quelques lignes ou appelez le ${phone}.` : "Décrivez vos travaux en quelques lignes : c’est le point de départ de votre devis.",
    },
    rationale: profile.audit.levers.map((lever) => ({
      leverId: lever.id,
      title: fit(lever.title, 100),
      body: {
        trouve: "Cette version donne à chaque prestation et à votre zone une place claire, visible dès l’arrivée.",
        choisi: "Vos preuves réelles sont placées là où le client hésite, juste avant la demande de devis.",
        contacte: "Le devis et l’appel restent accessibles à chaque écran, surtout sur mobile.",
      }[lever.axis],
    })),
  };
}
