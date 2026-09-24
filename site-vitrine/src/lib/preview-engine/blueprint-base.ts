import type { BlueprintSection, PreviewBlueprint, SectionType } from "./blueprint-schema";
import { buildTruthContext, checkCopy } from "./claims";
import { getBusinessUi, TRADE_FAMILIES, type ProofKind } from "./trades";
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

/** What a label means — general, verifiable definitions, never a claim beyond holding it. */
function labelExplanation(label: string): string {
  const l = label.toLowerCase();
  if (l === "rge") return "Reconnu Garant de l’Environnement : le signe de qualité exigé pour certaines aides à la rénovation énergétique.";
  if (l.includes("qualibat")) return "Qualification délivrée aux entreprises du bâtiment après examen de leurs compétences et de leurs références.";
  if (l.includes("qualipac")) return "Qualification des installateurs de pompes à chaleur.";
  if (l.includes("qualifelec")) return "Qualification des entreprises d’électricité.";
  if (l.includes("qualipv")) return "Qualification des installateurs photovoltaïques.";
  if (l.includes("qualibois")) return "Qualification des installateurs d’appareils de chauffage au bois.";
  if (l.includes("qualigaz") || l.includes("pgn")) return "Qualification des professionnels des installations gaz.";
  if (l.includes("handibat")) return "Savoir-faire reconnu pour l’adaptation des logements à l’accessibilité.";
  if (l.includes("maître artisan") || l.includes("maitre artisan")) return "Titre attribué par la Chambre de Métiers pour un savoir-faire reconnu.";
  return `${label} : qualification indiquée par l’entreprise.`;
}

export function buildBaseBlueprint(profile: VerifiedCompanyProfile): PreviewBlueprint {
  const family = TRADE_FAMILIES[profile.identity.tradeFamily];
  const ui = getBusinessUi(profile.identity.tradeFamily);
  const name = profile.identity.publicName.value;
  const trade = profile.identity.trade.value;
  const city = profile.identity.city?.value;
  const phone = profile.contacts.phone?.value;
  const assets = usableAssets(profile);
  const services = profile.services.slice(0, 6);
  const observedServices = services.filter((s) => s.confidence === "observed");
  const copyTruth = buildTruthContext(profile, "");
  const safeServiceDescription = (quote: string): string | null => {
    if (!quote) return null;
    const sentence = firstSentence(quote, 184);
    return checkCopy(sentence, copyTruth).ok ? `« ${sentence} »` : null;
  };
  const realisationAssets = assets.filter((asset) => asset.type === "realisation");
  const portfolioAssets = realisationAssets.length >= 2 ? realisationAssets : assets;
  const portfolioHeading = realisationAssets.length >= 2 ? ui.portfolioNav : "En images";

  const wantsProjectHero = family.heroWithPhoto === "HeroProject" && assets.length >= 2;
  const wantsLocalHero = family.heroWithPhoto === "HeroLocal" && Boolean(city);
  const templateFamily: PreviewBlueprint["templateFamily"] = wantsProjectHero ? "project" : wantsLocalHero ? "local" : "editorial";
  const heroImage = wantsProjectHero ? assets.find((a) => a.type === "realisation") ?? assets[0] : undefined;
  const heroVariant = heroImage ? family.heroWithPhoto : wantsLocalHero ? "HeroLocal" : "HeroEditorial";

  const serviceNames = services.slice(0, 3).map((s) => lowerFirst(s.name));
  const subheadline = serviceNames.length
    ? `${serviceNames.length > 1 ? listOf(serviceNames) : serviceNames[0]}. ${ui.subheadline}`
    : ui.subheadline;

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
    if (item.kind === "certification") why.push({ title: fit(item.label, 48), body: labelExplanation(item.label), factRef: item.id });
    if (item.kind === "insurance") why.push({ title: "Assurance décennale", body: "Les ouvrages sont couverts dix ans après réception, selon l’assurance indiquée par l’entreprise.", factRef: item.id });
  }
  if (profile.trust.experienceQuote && why.length < 4) {
    why.push({ title: "Savoir-faire", body: `« ${firstSentence(profile.trust.experienceQuote.value, 170)} »`, factRef: "experience" });
  } else if (profile.identity.foundedYear && why.length < 4) {
    why.push({ title: `Depuis ${profile.identity.foundedYear.value}`, body: `Entreprise immatriculée en ${profile.identity.foundedYear.value}.`, factRef: "founded" });
  }
  if (phone && why.length < 4) why.push({ title: "Un interlocuteur direct", body: `Un appel au ${phone} suffit pour parler de votre projet.`, factRef: "phone" });
  if (city && why.length < 4) why.push({ title: fit(`Basée à ${city}`, 48), body: `Une entreprise implantée à ${city}.`, factRef: "city" });
  if (why.length === 0) why.push({ title: "Une demande simple", body: "Chaque prise de contact part d’un besoin décrit en quelques lignes.", factRef: "quote" });
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
    ...(ui.showArea && (city || profile.areas.zoneQuote) ? { area: { type: "area", variant: "AreaLocal" } } : {}),
    ...(profile.presence.level === "C" || (!assets.length && profile.identity.foundedYear) ? { about: { type: "about", variant: "AboutCompany" } } : {}),
    cta: { type: "cta", variant: "CtaQuote" },
  };
  const proofSections: Record<ProofKind, SectionType[]> = { portfolio: ["portfolio"], labels: ["why"], reviews: ["why"] };
  const middle = [...new Set(family.proofOrder.flatMap((kind) => proofSections[kind]))];
  const order: SectionType[] = ["trust", "services", ...middle, "about", "area", "cta"];
  const sections = [...new Set(order)].map((type) => available[type]).filter(Boolean) as BlueprintSection[];

  const aboutParts = [
    `${name} est ${city ? `basée à ${city}` : `active dans le secteur ${family.label.toLowerCase()}`}${profile.identity.foundedYear ? `, immatriculée en ${profile.identity.foundedYear.value}` : ""}.`,
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
    primaryCta: { label: ui.primaryCta },
    secondaryCta: phone ? { label: "Appeler" } : null,
    sections,
    services: {
      heading: observedServices.length ? ui.offerNav : family.label,
      intro: null,
      items: (services.length ? services : []).map((service) => ({
        serviceId: service.id,
        title: fit(service.name, 60),
        description: safeServiceDescription(service.quote),
      })),
    },
    proof: { strategy: proofStrategy, trustIds, reviewIds },
    portfolio: {
      heading: portfolioHeading,
      assetIds: portfolioAssets.slice(0, 7).map((a) => a.id),
    },
    why: { heading: name.length <= 44 ? `Pourquoi choisir ${name}` : "Pourquoi nous choisir", points: why.slice(0, 4) },
    area: ui.showArea && (city || profile.areas.zoneQuote)
      ? {
          heading: profile.areas.zoneQuote ? ui.locationNav : fit(`Basée à ${city}`, 70),
          body: profile.areas.zoneQuote
            ? `« ${firstSentence(profile.areas.zoneQuote.value, 234)} »`
            : ui.locationPrompt,
        }
      : null,
    about: { heading: name.length <= 55 ? `À propos de ${name}` : "À propos", body: fit(aboutParts.join(" "), 420) },
    finalCta: {
      heading: ui.finalHeading,
      body: ui.finalBody,
    },
    rationale: profile.audit.levers.map((lever) => ({
      leverId: lever.id,
      title: fit(lever.title, 100),
      body: {
        trouve: "Cette version donne à l’offre et aux informations clés une place claire, visible dès l’arrivée.",
        choisi: "Vos preuves réelles sont placées là où le client hésite, juste avant l’action principale.",
        contacte: "L’action principale et le contact restent accessibles à chaque écran, surtout sur mobile.",
      }[lever.axis],
    })),
  };
}
