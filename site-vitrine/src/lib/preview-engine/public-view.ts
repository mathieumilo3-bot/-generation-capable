import type { PreviewBlueprint } from "./blueprint-schema";
import { derivePalette, type PreviewPalette } from "./colors";
import { proxiedAssetPath } from "./tokens";
import { TRADE_FAMILIES, type Motif, type TradeFamilyId } from "./trades";
import type { AuditLever, PresenceLevel, ReviewFact, VerifiedCompanyProfile } from "./types";

/**
 * What the browser receives: the validated blueprint plus exactly the
 * verified values the renderer needs — nothing from the raw crawl, the
 * research notes or the intermediate work. Image URLs are rewritten to the
 * signed proxy, so the visitor's browser never contacts a third-party site.
 */

export type PreviewAssetView = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  kind: "realisation" | "site";
  caption: string;
};

export type PreviewDocument = {
  v: 1;
  id: string;
  generatedAt: string;
  presenceLevel: PresenceLevel;
  tradeFamily: TradeFamilyId;
  motif: Motif;
  palette: PreviewPalette;
  site: {
    name: string;
    trade: string;
    city?: string;
    postcode?: string;
    address?: string;
    phone?: string;
    email?: string;
    currentDomain?: string;
    logo?: { src: string; alt: string };
    socials: { network: string; url: string }[];
    siren?: string;
    legalName?: string;
    foundedYear?: string;
  };
  services: Record<string, { name: string; quote: string; hasPage: boolean }>;
  trust: { id: string; label: string; kind: string }[];
  reviews: Pick<ReviewFact, "id" | "platform" | "rating" | "count" | "source">[];
  assets: Record<string, PreviewAssetView>;
  zoneQuote?: string;
  blueprint: PreviewBlueprint;
  levers: AuditLever[];
  auditSummary: string;
  /** "Construite à partir de…" — the provenance of what is shown. */
  provenance: { label: string; value: string; source: string }[];
};

function tel(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function toPreviewDocument(id: string, profile: VerifiedCompanyProfile, blueprint: PreviewBlueprint): PreviewDocument {
  const family = TRADE_FAMILIES[profile.identity.tradeFamily];
  const assets: Record<string, PreviewAssetView> = {};
  for (const asset of profile.portfolioAssets) {
    assets[asset.id] = {
      src: proxiedAssetPath(asset.url),
      alt: asset.alt || `${profile.identity.trade.value} — ${profile.identity.publicName.value}`,
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
      kind: asset.type === "realisation" ? "realisation" : "site",
      caption: asset.type === "realisation" ? "Réalisation publiée sur votre site" : "Photo publiée sur votre site",
    };
  }

  const provenance: PreviewDocument["provenance"] = [
    { label: "Nom", value: profile.identity.publicName.value, source: profile.identity.publicName.source },
    { label: "Métier", value: profile.identity.trade.value, source: profile.identity.trade.source },
    ...(profile.identity.city ? [{ label: "Ville", value: profile.identity.city.value, source: profile.identity.city.source }] : []),
    ...(profile.contacts.phone ? [{ label: "Téléphone", value: profile.contacts.phone.value, source: profile.contacts.phone.source }] : []),
    ...(profile.services.length ? [{ label: "Prestations", value: `${profile.services.length}`, source: profile.services[0].source }] : []),
    ...(profile.portfolioAssets.length ? [{ label: "Photos", value: `${profile.portfolioAssets.length}`, source: "publiées sur votre site actuel" }] : []),
    ...profile.trust.items.filter((t) => t.kind !== "registry").map((t) => ({ label: "Label", value: t.label, source: t.source })),
  ];

  return {
    v: 1,
    id,
    generatedAt: profile.generatedAt,
    presenceLevel: profile.presence.level,
    tradeFamily: profile.identity.tradeFamily,
    motif: family.motif,
    palette: derivePalette(profile.branding.observedColors?.value, family.accent),
    site: {
      name: profile.identity.publicName.value,
      trade: profile.identity.trade.value,
      ...(profile.identity.city ? { city: profile.identity.city.value } : {}),
      ...(profile.identity.postcode ? { postcode: profile.identity.postcode.value } : {}),
      ...(profile.identity.address ? { address: profile.identity.address.value } : {}),
      ...(profile.contacts.phone ? { phone: profile.contacts.phone.value } : {}),
      ...(profile.contacts.email ? { email: profile.contacts.email.value } : {}),
      ...(profile.identity.officialDomain ? { currentDomain: profile.identity.officialDomain.value } : {}),
      ...(profile.branding.logo ? { logo: { src: proxiedAssetPath(profile.branding.logo.url), alt: profile.branding.logo.alt || profile.identity.publicName.value } } : {}),
      socials: profile.contacts.socials.filter((s) => /^https:\/\//.test(s.url)).slice(0, 4),
      ...(profile.identity.siren ? { siren: profile.identity.siren.value } : {}),
      ...(profile.identity.legalName ? { legalName: profile.identity.legalName.value } : {}),
      ...(profile.identity.foundedYear ? { foundedYear: profile.identity.foundedYear.value } : {}),
    },
    services: Object.fromEntries(profile.services.map((s) => [s.id, { name: s.name, quote: s.quote, hasPage: Boolean(s.dedicatedPage) }])),
    trust: profile.trust.items.map((t) => ({ id: t.id, label: t.label, kind: t.kind })),
    reviews: profile.reviews.map((r) => ({ id: r.id, platform: r.platform, rating: r.rating, count: r.count, source: r.source })),
    assets,
    ...(profile.areas.zoneQuote ? { zoneQuote: profile.areas.zoneQuote.value } : {}),
    blueprint,
    levers: profile.audit.levers,
    auditSummary: profile.audit.summary,
    provenance,
  };
}

export function telHref(phone: string): string {
  return `tel:${tel(phone)}`;
}
