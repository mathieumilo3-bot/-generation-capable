import type { Confidence } from "@/lib/audit-engine/types";
import type { Axis } from "@/lib/audit-engine/facts";
import type { TradeFamilyId } from "./trades";

/**
 * The truth bundle — everything the preview is allowed to say about a
 * company. The blueprint generator and the renderer read from here and only
 * from here: a detail that is not in this object does not exist.
 *
 * Every fact keeps where it came from (`source`) and how sure we are
 * (`confidence`, the same OBSERVED / INFERRED vocabulary as the audit
 * engine). UNKNOWN facts are simply absent — never filled in.
 */
export type Fact<T> = {
  value: T;
  source: string;
  confidence: Exclude<Confidence, "unknown">;
};

export type ServiceFact = {
  /** Stable id the blueprint must reference, e.g. "svc_1". */
  id: string;
  name: string;
  /** Short sentence quoted from the site around the first mention. */
  quote: string;
  /** Path of a page dedicated to this service on the current site. */
  dedicatedPage?: string;
  source: string;
  confidence: Exclude<Confidence, "unknown">;
};

export type TrustFact = {
  id: string;
  label: string;
  kind: "certification" | "insurance" | "membership" | "registry";
  source: string;
  confidence: Exclude<Confidence, "unknown">;
};

export type ReviewFact = {
  id: string;
  platform: string;
  /** e.g. "4,8/5" — only when displayed verbatim by the source. */
  rating?: string;
  /** e.g. "37 avis" — only when displayed verbatim by the source. */
  count?: string;
  source: string;
  confidence: Exclude<Confidence, "unknown">;
};

export type PortfolioAsset = {
  id: string;
  /** Original public URL on the company's site. Served to visitors only through the signed proxy. */
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /**
   * realisation — published on a réalisations/chantiers page of the official site;
   * site — published elsewhere on the official site (home, service page);
   * logo — the company's own logo.
   */
  type: "realisation" | "site" | "logo";
  /** Page of the official site it was published on. */
  pagePath: string;
  source: string;
};

export type AuditLever = {
  id: string;
  axis: Axis;
  title: string;
  finding: string;
  fix: string;
  basis: string;
};

export type PresenceLevel =
  /** A: rich data, readable site, research done. */
  | "A"
  /** B: site found but only partly readable. */
  | "B"
  /** C: no site — built from verified public identity. */
  | "C";

export type VerifiedCompanyProfile = {
  v: 1;
  generatedAt: string;
  presence: {
    level: PresenceLevel;
    hasSite: boolean;
    siteReadable: boolean;
    pagesRead: number;
  };
  identity: {
    publicName: Fact<string>;
    legalName?: Fact<string>;
    siren?: Fact<string>;
    city?: Fact<string>;
    postcode?: Fact<string>;
    address?: Fact<string>;
    trade: Fact<string>;
    tradeFamily: TradeFamilyId;
    officialDomain?: Fact<string>;
    officialUrl?: Fact<string>;
    foundedYear?: Fact<string>;
    naf?: Fact<string>;
  };
  branding: {
    logo?: PortfolioAsset;
    /** Hex colours seen on the official site, most prominent first. */
    observedColors: Fact<string[]> | null;
    siteTitle?: Fact<string>;
  };
  contacts: {
    phone?: Fact<string>;
    /** Every other distinct public number seen, kept for consistency checks. */
    otherPhones: string[];
    email?: Fact<string>;
    socials: { network: string; url: string }[];
    hasQuoteForm: boolean;
  };
  services: ServiceFact[];
  areas: {
    /** Where the company is based (registry or site). Never presented as a service area on its own. */
    base?: Fact<string>;
    /** Verbatim sentence of the site describing the area served. */
    zoneQuote?: Fact<string>;
    /** Titles of local pages found on the site. */
    localPages: string[];
  };
  trust: {
    items: TrustFact[];
    legalNotice: boolean;
    experienceQuote?: Fact<string>;
  };
  reviews: ReviewFact[];
  portfolioAssets: PortfolioAsset[];
  audit: {
    levers: AuditLever[];
    summary: string;
    mode: "ai" | "site";
    researchIdentityCheck?: string;
  };
};
