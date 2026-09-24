import { z } from "zod";

/**
 * The PreviewBlueprint is the ONLY thing the model produces for a preview:
 * a strict JSON choice among whitelisted sections and variants, plus short
 * copy. It never contains HTML, CSS, URLs or code. The deterministic
 * renderer turns it into a page with our own components.
 */

export const SECTION_VARIANTS = {
  trust: ["TrustStrip"],
  services: ["ServicesGrid", "ServicesEditorial", "ServiceSpotlight"],
  portfolio: ["PortfolioGrid", "PortfolioFeature"],
  why: ["WhyCompany"],
  area: ["AreaLocal"],
  about: ["AboutCompany"],
  cta: ["CtaQuote"],
} as const;

export type SectionType = keyof typeof SECTION_VARIANTS;
export const SECTION_TYPES = Object.keys(SECTION_VARIANTS) as SectionType[];
export const HERO_VARIANTS = ["HeroEditorial", "HeroProject", "HeroLocal"] as const;
export const TEMPLATE_FAMILIES = ["editorial", "project", "local"] as const;

const copy = (max: number) => z.string().trim().min(2).max(max);
const id = z.string().regex(/^[a-z_0-9]{2,24}$/);

export const heroSchema = z.object({
  variant: z.enum(HERO_VARIANTS),
  eyebrow: copy(64),
  headline: copy(90),
  subheadline: copy(200),
  imageAssetId: id.nullable(),
});

export const ctaSchema = z.object({ label: copy(32) });

export const sectionSchema = z
  .object({ type: z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]), variant: z.string().max(32) })
  .refine((s) => (SECTION_VARIANTS[s.type] as readonly string[]).includes(s.variant), { message: "variant not allowed for section" });

export const servicesSchema = z.object({
  heading: copy(70),
  intro: copy(180).nullable(),
  items: z
    .array(z.object({ serviceId: id, title: copy(60), description: copy(190).nullable() }))
    // Empty when no service could be verified: the section is then dropped, never filled.
    .max(6),
});

export const proofSchema = z.object({
  strategy: z.enum(["reviews", "labels", "portfolio", "registry", "none"]),
  trustIds: z.array(id).max(6),
  reviewIds: z.array(id).max(3),
});

export const portfolioSchema = z.object({
  heading: copy(70),
  assetIds: z.array(id).max(9),
});

export const whySchema = z.object({
  heading: copy(70),
  points: z.array(z.object({ title: copy(48), body: copy(200), factRef: id })).min(1).max(4),
});

export const areaSchema = z.object({ heading: copy(70), body: copy(260) }).nullable();
export const aboutSchema = z.object({ heading: copy(70), body: copy(420) }).nullable();
export const finalCtaSchema = z.object({ heading: copy(80), body: copy(200) });
export const rationaleSchema = z.array(z.object({ leverId: id, title: copy(100), body: copy(240) })).max(3);

export const blueprintSchema = z.object({
  version: z.literal(1),
  templateFamily: z.enum(TEMPLATE_FAMILIES),
  hero: heroSchema,
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema.nullable(),
  sections: z.array(sectionSchema).min(2).max(8),
  services: servicesSchema,
  proof: proofSchema,
  portfolio: portfolioSchema,
  why: whySchema,
  area: areaSchema,
  about: aboutSchema,
  finalCta: finalCtaSchema,
  rationale: rationaleSchema,
});

export type PreviewBlueprint = z.infer<typeof blueprintSchema>;
export type BlueprintSection = z.infer<typeof sectionSchema>;

/** Field-level schemas, so a single bad field falls back alone instead of the whole blueprint. */
export const FIELD_SCHEMAS = {
  templateFamily: z.enum(TEMPLATE_FAMILIES),
  hero: heroSchema,
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema.nullable(),
  services: servicesSchema,
  proof: proofSchema,
  portfolio: portfolioSchema,
  why: whySchema,
  area: areaSchema,
  about: aboutSchema,
  finalCta: finalCtaSchema,
  rationale: rationaleSchema,
} as const;

// ---------------------------------------------------------------------------
// JSON Schema handed to the model (strict structured output). Hand-written:
// strict mode needs every property required and no unsupported keywords;
// length limits are enforced afterwards by the Zod schema above.

const S = { type: "string" } as const;
const nullableString = { anyOf: [S, { type: "null" }] };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

export const BLUEPRINT_JSON_SCHEMA = obj({
  version: { type: "integer", enum: [1] },
  templateFamily: { type: "string", enum: [...TEMPLATE_FAMILIES] },
  hero: obj({
    variant: { type: "string", enum: [...HERO_VARIANTS] },
    eyebrow: S,
    headline: S,
    subheadline: S,
    imageAssetId: nullableString,
  }),
  primaryCta: obj({ label: S }),
  secondaryCta: nullable(obj({ label: S })),
  sections: {
    type: "array",
    items: obj({
      type: { type: "string", enum: SECTION_TYPES },
      variant: { type: "string", enum: [...new Set(Object.values(SECTION_VARIANTS).flat())] },
    }),
  },
  services: obj({
    heading: S,
    intro: nullableString,
    items: { type: "array", items: obj({ serviceId: S, title: S, description: nullableString }) },
  }),
  proof: obj({
    strategy: { type: "string", enum: ["reviews", "labels", "portfolio", "registry", "none"] },
    trustIds: { type: "array", items: S },
    reviewIds: { type: "array", items: S },
  }),
  portfolio: obj({ heading: S, assetIds: { type: "array", items: S } }),
  why: obj({ heading: S, points: { type: "array", items: obj({ title: S, body: S, factRef: S }) } }),
  area: nullable(obj({ heading: S, body: S })),
  about: nullable(obj({ heading: S, body: S })),
  finalCta: obj({ heading: S, body: S }),
  rationale: { type: "array", items: obj({ leverId: S, title: S, body: S }) },
});
