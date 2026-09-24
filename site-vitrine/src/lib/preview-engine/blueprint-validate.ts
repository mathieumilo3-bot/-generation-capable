import { usableAssets } from "./blueprint-base";
import {
  blueprintSchema,
  FIELD_SCHEMAS,
  sectionSchema,
  type BlueprintSection,
  type PreviewBlueprint,
  type SectionType,
} from "./blueprint-schema";
import { normalize } from "@/lib/audit-engine/crawl";
import { checkAllCopy, checkCopy, type TruthContext } from "./claims";
import type { VerifiedCompanyProfile } from "./types";

export type BlueprintRejection = { field: string; reason: string };

export type ValidatedBlueprint = {
  blueprint: PreviewBlueprint;
  rejections: BlueprintRejection[];
  /** "ai" when every field of the model survived, "mixed" when some fell back, "base" when none did. */
  source: "ai" | "mixed" | "base";
};

type Field = keyof typeof FIELD_SCHEMAS;

function factRefs(profile: VerifiedCompanyProfile): Set<string> {
  const refs = new Set<string>(["quote"]);
  for (const t of profile.trust.items) refs.add(t.id);
  for (const s of profile.services) refs.add(s.id);
  for (const r of profile.reviews) refs.add(r.id);
  if (profile.trust.experienceQuote) refs.add("experience");
  if (profile.identity.foundedYear) refs.add("founded");
  if (profile.contacts.phone) refs.add("phone");
  if (profile.identity.city) refs.add("city");
  if (profile.areas.zoneQuote) refs.add("zone");
  return refs;
}

/**
 * Validates one field of the model's blueprint against its schema, the
 * identifiers the profile really has, and the anti-invention guard. Returns
 * the cleaned value or a reason for refusal.
 */
function validateField(
  field: Field,
  raw: unknown,
  profile: VerifiedCompanyProfile,
  truth: TruthContext
): { ok: true; value: unknown } | { ok: false; reason: string } {
  const parsed = FIELD_SCHEMAS[field].safeParse(raw);
  if (!parsed.success) return { ok: false, reason: `schéma: ${parsed.error.issues[0]?.path.join(".") || ""} ${parsed.error.issues[0]?.message ?? ""}`.trim() };
  const value = parsed.data as never;
  const assets = new Map(usableAssets(profile).map((a) => [a.id, a]));
  const copy = (v: unknown, skip: string[] = []) => checkAllCopy(v, truth, new Set(skip));

  switch (field) {
    case "hero": {
      const hero = value as PreviewBlueprint["hero"];
      if (hero.imageAssetId && !assets.has(hero.imageAssetId)) return { ok: false, reason: "image inconnue" };
      if (hero.variant === "HeroProject" && !hero.imageAssetId) return { ok: false, reason: "HeroProject sans image" };
      const c = copy(hero, ["variant", "imageAssetId"]);
      return c.ok ? { ok: true, value: hero } : { ok: false, reason: c.reason };
    }
    case "primaryCta": {
      const cta = value as PreviewBlueprint["primaryCta"];
      if (!/devis|projet|estimation|contact/i.test(cta.label)) return { ok: false, reason: "action principale hors devis" };
      const c = checkCopy(cta.label, truth);
      return c.ok ? { ok: true, value: cta } : { ok: false, reason: c.reason };
    }
    case "secondaryCta": {
      const cta = value as PreviewBlueprint["secondaryCta"];
      if (cta === null) return { ok: true, value: null };
      if (!profile.contacts.phone) return { ok: false, reason: "appel sans téléphone vérifié" };
      if (!/appel|t[ée]l[ée]phon/i.test(cta.label)) return { ok: false, reason: "action secondaire hors appel" };
      const c = checkCopy(cta.label, truth);
      return c.ok ? { ok: true, value: cta } : { ok: false, reason: c.reason };
    }
    case "services": {
      const services = value as PreviewBlueprint["services"];
      const known = new Set(profile.services.map((s) => s.id));
      const seen = new Set<string>();
      const items = services.items.filter((item) => {
        if (!known.has(item.serviceId) || seen.has(item.serviceId)) return false;
        seen.add(item.serviceId);
        return copy(item, ["serviceId"]).ok;
      });
      if (items.length === 0 && profile.services.length > 0) return { ok: false, reason: "aucun service vérifié" };
      const head = copy({ heading: services.heading, intro: services.intro });
      if (!head.ok) return { ok: false, reason: head.reason };
      return { ok: true, value: { ...services, items } };
    }
    case "proof": {
      const proof = value as PreviewBlueprint["proof"];
      const trustIds = proof.trustIds.filter((id) => profile.trust.items.some((t) => t.id === id));
      const reviewIds = proof.reviewIds.filter((id) => profile.reviews.some((r) => r.id === id));
      if (proof.strategy === "reviews" && reviewIds.length === 0) return { ok: false, reason: "preuve avis sans avis" };
      if (proof.strategy === "labels" && trustIds.length === 0) return { ok: false, reason: "preuve labels sans label" };
      if (proof.strategy === "portfolio" && assets.size < 2) return { ok: false, reason: "preuve photos sans photos" };
      return { ok: true, value: { ...proof, trustIds, reviewIds } };
    }
    case "portfolio": {
      const portfolio = value as PreviewBlueprint["portfolio"];
      const assetIds = [...new Set(portfolio.assetIds.filter((id) => assets.has(id)))];
      if (/r[ée]alisation|chantier|projet/i.test(portfolio.heading) && !assetIds.some((id) => assets.get(id)?.type === "realisation")) {
        return { ok: false, reason: "photos présentées comme réalisations sans page réalisations" };
      }
      const c = checkCopy(portfolio.heading, truth);
      return c.ok ? { ok: true, value: { ...portfolio, assetIds } } : { ok: false, reason: c.reason };
    }
    case "why": {
      const why = value as PreviewBlueprint["why"];
      const refs = factRefs(profile);
      const labels = profile.trust.items.filter((t) => t.kind !== "registry").map((t) => ({ id: t.id, key: normalize(t.label) }));
      const seenTitles = new Set<string>();
      const points = why.points.filter((p) => {
        if (!refs.has(p.factRef) || !copy(p, ["factRef"]).ok) return false;
        const text = normalize(`${p.title} ${p.body}`);
        // A point about a label must name THAT label, and no other one.
        const own = labels.find((l) => l.id === p.factRef);
        if (own && !text.includes(own.key.split(" ")[0]) && !(own.key.includes("decennale") && text.includes("decennale"))) return false;
        if (labels.some((l) => l.id !== p.factRef && l.key.length >= 3 && text.includes(l.key))) return false;
        const title = normalize(p.title);
        if (seenTitles.has(title)) return false;
        seenTitles.add(title);
        return true;
      });
      if (points.length === 0) return { ok: false, reason: "aucun point prouvé" };
      const c = checkCopy(why.heading, truth);
      return c.ok ? { ok: true, value: { ...why, points } } : { ok: false, reason: c.reason };
    }
    case "area": {
      const area = value as PreviewBlueprint["area"];
      if (area === null) return { ok: true, value: null };
      if (!profile.identity.city && !profile.areas.zoneQuote) return { ok: false, reason: "zone sans donnée vérifiée" };
      const c = copy(area);
      return c.ok ? { ok: true, value: area } : { ok: false, reason: c.reason };
    }
    case "rationale": {
      const rationale = value as PreviewBlueprint["rationale"];
      const levers = new Set(profile.audit.levers.map((l) => l.id));
      const seen = new Set<string>();
      const items = rationale.filter((r) => {
        if (!levers.has(r.leverId) || seen.has(r.leverId)) return false;
        seen.add(r.leverId);
        return copy(r, ["leverId"]).ok;
      });
      if (items.length < Math.min(levers.size, 3) && items.length === 0 && levers.size > 0) return { ok: false, reason: "aucun levier valide" };
      return { ok: true, value: items };
    }
    default: {
      const c = copy(value);
      return c.ok ? { ok: true, value } : { ok: false, reason: c.reason };
    }
  }
}

function sectionHasContent(type: SectionType, blueprint: PreviewBlueprint, profile: VerifiedCompanyProfile): boolean {
  switch (type) {
    case "trust":
      return blueprint.proof.trustIds.length + blueprint.proof.reviewIds.length > 0 || Boolean(profile.identity.siren);
    case "services":
      return blueprint.services.items.length > 0;
    case "portfolio":
      return blueprint.portfolio.assetIds.length >= 2;
    case "why":
      return blueprint.why.points.length > 0;
    case "area":
      return blueprint.area !== null;
    case "about":
      return blueprint.about !== null;
    case "cta":
      return true;
  }
}

/** Keeps sections that are allowed, unique and backed by content; the quote CTA always closes the page. */
export function normalizeSections(sections: BlueprintSection[], blueprint: PreviewBlueprint, profile: VerifiedCompanyProfile): BlueprintSection[] {
  const seen = new Set<SectionType>();
  const kept: BlueprintSection[] = [];
  for (const section of sections) {
    if (!sectionSchema.safeParse(section).success || seen.has(section.type) || section.type === "cta") continue;
    if (!sectionHasContent(section.type, blueprint, profile)) continue;
    // Variant must suit the amount of material.
    let variant = section.variant;
    if (section.type === "services") {
      const n = blueprint.services.items.length;
      if (n === 1) variant = "ServiceSpotlight";
      else if (variant === "ServiceSpotlight") variant = n >= 4 ? "ServicesGrid" : "ServicesEditorial";
    }
    if (section.type === "portfolio" && blueprint.portfolio.assetIds.length < 5) variant = "PortfolioFeature";
    seen.add(section.type);
    kept.push({ type: section.type, variant });
  }
  return [...kept.slice(0, 7), { type: "cta", variant: "CtaQuote" }];
}

export function validateBlueprint(
  raw: unknown,
  profile: VerifiedCompanyProfile,
  truth: TruthContext,
  base: PreviewBlueprint
): ValidatedBlueprint {
  const rejections: BlueprintRejection[] = [];
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) {
    return { blueprint: finalize(base, base.sections, profile), rejections: [{ field: "*", reason: "aucun blueprint du modèle" }], source: "base" };
  }

  const merged: PreviewBlueprint = { ...base };
  let accepted = 0;
  const fields = Object.keys(FIELD_SCHEMAS) as Field[];
  for (const field of fields) {
    const result = validateField(field, source[field], profile, truth);
    if (result.ok) {
      (merged as Record<string, unknown>)[field] = result.value;
      accepted += 1;
    } else {
      rejections.push({ field, reason: result.reason });
    }
  }

  // Sections are decided once the content is known.
  const rawSections = Array.isArray(source.sections) ? (source.sections as BlueprintSection[]) : [];
  let sections = normalizeSections(rawSections, merged, profile);
  if (!sections.some((s) => s.type === "services") && merged.services.items.length > 0) {
    rejections.push({ field: "sections", reason: "services absents" });
    sections = normalizeSections(base.sections, merged, profile);
  } else if (rawSections.length > 0) {
    accepted += 1;
  }

  const blueprint = finalize(merged, sections, profile);
  const total = fields.length + 1;
  return { blueprint, rejections, source: accepted === total ? "ai" : accepted === 0 ? "base" : "mixed" };
}

function finalize(blueprint: PreviewBlueprint, sections: BlueprintSection[], profile: VerifiedCompanyProfile): PreviewBlueprint {
  const assets = usableAssets(profile);
  const out: PreviewBlueprint = { ...blueprint, sections: normalizeSections(sections, blueprint, profile) };
  if (!out.hero.imageAssetId && out.hero.variant === "HeroProject") out.hero = { ...out.hero, variant: profile.identity.city ? "HeroLocal" : "HeroEditorial" };
  if (out.hero.imageAssetId && !assets.some((a) => a.id === out.hero.imageAssetId)) out.hero = { ...out.hero, imageAssetId: null };
  if (!profile.contacts.phone) out.secondaryCta = null;
  // The contract with the renderer: a blueprint that leaves here always parses.
  return blueprintSchema.parse(out);
}
