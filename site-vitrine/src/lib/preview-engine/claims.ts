import { normalize } from "@/lib/audit-engine/crawl";
import type { VerifiedCompanyProfile } from "./types";

/**
 * The anti-invention guard. Every sentence that ends up on a preview —
 * written by the model OR by our own templates — goes through `checkCopy`.
 *
 * The rule is asymmetric on purpose: a claim is refused unless the truth
 * bundle (the verified profile + the text actually read on the company's
 * site) supports it. When in doubt, the sentence is dropped and the
 * deterministic copy is used instead.
 */

export type TruthContext = {
  /** Normalized text of every page read + every verified profile value. */
  text: string;
  /** Normalized digit runs that are allowed to appear in copy. */
  numbers: Set<string>;
  hasReviews: boolean;
  hasReviewScore: boolean;
  certifications: string[];
  hasInsurance: boolean;
  hasExperience: boolean;
  foundedYear?: string;
};

function digits(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

export function buildTruthContext(profile: VerifiedCompanyProfile, siteHaystack: string): TruthContext {
  const values: string[] = [
    profile.identity.publicName.value,
    profile.identity.legalName?.value ?? "",
    profile.identity.city?.value ?? "",
    profile.identity.postcode?.value ?? "",
    profile.identity.address?.value ?? "",
    profile.identity.trade.value,
    profile.identity.officialDomain?.value ?? "",
    profile.identity.foundedYear?.value ?? "",
    profile.identity.siren?.value ?? "",
    profile.contacts.phone?.value ?? "",
    profile.contacts.email?.value ?? "",
    ...profile.services.flatMap((s) => [s.name, s.quote]),
    profile.areas.zoneQuote?.value ?? "",
    ...profile.areas.localPages,
    ...profile.trust.items.map((t) => t.label),
    profile.trust.experienceQuote?.value ?? "",
    ...profile.reviews.flatMap((r) => [r.platform, r.rating ?? "", r.count ?? ""]),
    ...profile.portfolioAssets.map((a) => a.alt),
    ...profile.audit.levers.flatMap((l) => [l.title, l.finding, l.fix]),
  ];
  const text = normalize(`${siteHaystack}\n${values.filter(Boolean).join("\n")}`);
  const numbers = new Set<string>();
  // Numbers from the verified values only — not from the whole site text,
  // where a price or a count may sit in a context we cannot see.
  for (const value of values) for (const d of digits(normalize(value))) numbers.add(d);
  if (profile.contacts.phone) for (const d of digits(profile.contacts.phone.value.replace(/\s/g, ""))) numbers.add(d);
  return {
    text,
    numbers,
    hasReviews: profile.reviews.length > 0,
    hasReviewScore: profile.reviews.some((r) => r.rating),
    certifications: profile.trust.items.filter((t) => t.kind === "certification").map((t) => normalize(t.label)),
    hasInsurance: profile.trust.items.some((t) => t.kind === "insurance"),
    hasExperience: Boolean(profile.trust.experienceQuote || profile.identity.foundedYear),
    ...(profile.identity.foundedYear ? { foundedYear: profile.identity.foundedYear.value } : {}),
  };
}

type Rule = { name: string; re: RegExp; allowed: (truth: TruthContext, text: string) => boolean };

const has = (truth: TruthContext, re: RegExp) => re.test(truth.text);

const RULES: Rule[] = [
  // Superlatives nobody can verify.
  { name: "superlatif", re: /\b(?:n\s?°\s?1|numero un|leader|le meilleur|la meilleure|les meilleurs|incontournable|imbattable|sans egal|expert reconnu|reference (?:du|de la|en))\b/, allowed: () => false },
  { name: "gratuit", re: /\b(?:gratuit|gratuite|gratuits|offert|offerte|sans frais)\b/, allowed: (t) => has(t, /\bgratuit/) },
  { name: "urgence / 24-7", re: /\b(?:24\s?h|24\s?\/\s?24|7\s?j|7\s?\/\s?7|urgence|urgences|dans l.heure|intervention rapide|depannage rapide|jour et nuit|week-end)\b/, allowed: (t) => has(t, /urgence|24\s?h|24\s?\/\s?24|7\s?j|7\s?\/\s?7|depannage/) },
  { name: "décennale", re: /decennale/, allowed: (t) => t.hasInsurance },
  {
    name: "label",
    re: /\b(?:rge|qualibat|qualipac|qualifelec|qualit.?enr|qualibois|qualigaz|qualipv|handibat|eco artisan|maitre artisan|certifie|certifiee|certifies|labellise|labellisee|agree|agreee|qualifie|qualifiee)\b/,
    allowed: (t, text) => {
      if (t.certifications.length === 0) return false;
      const named = text.match(/\b(rge|qualibat|qualipac|qualifelec|qualit.?enr|qualibois|qualigaz|qualipv|handibat|eco artisan|maitre artisan)\b/g) ?? [];
      return named.every((label) => t.certifications.some((c) => c.includes(label.replace(/\s+/g, " "))));
    },
  },
  { name: "garantie", re: /\bgaranti/, allowed: (t) => has(t, /\bgaranti/) },
  { name: "avis", re: /\b(?:avis|etoiles?|temoignages?|recommande|recommandent|clients? satisfaits?|satisfaction)\b/, allowed: (t) => t.hasReviews },
  { name: "note", re: /\b[1-5][,.]\d\s*\/\s*5\b|\bnote(?:e|s)? (?:de|moyenne)\b/, allowed: (t) => t.hasReviewScore },
  {
    name: "expérience",
    re: /\b(?:ans d.experience|annees d.experience|d.experience|depuis (?:19|20)\d\d|generations?|familial|familiale|pere en fils|savoir-faire ancestral)\b/,
    allowed: (t, text) => {
      if (/familial|pere en fils|generation/.test(text) && !has(t, /familial|pere en fils|generation/)) return false;
      return t.hasExperience;
    },
  },
  { name: "prix", re: /€|\beuros?\b|\bprix\b|\btarifs?\b|moins cher|pas cher|petit prix|remise|promotion|promo\b/, allowed: () => false },
  { name: "délai promis", re: /\b(?:sous|en moins de|dans les) \d+\s?(?:h|heures?|jours?|min|minutes?)\b|\breponse (?:immediate|rapide|garantie)\b/, allowed: () => false },
  { name: "partenaire / marque", re: /\b(?:partenaire officiel|installateur agree|concessionnaire|distributeur officiel)\b/, allowed: (t) => has(t, /partenaire|agree|concessionnaire|distributeur/) },
];

const LOCATIVE = /\b(?:a|au|aux|en|sur|dans le|dans la|dans les|autour de|pres de|region|secteur de)\s+([A-ZÉÈÀÂÎÔÛÇ][\p{L}'-]+(?:[\s-][A-ZÉÈÀÂÎÔÛÇ][\p{L}'-]+)*)/gu;

export type CopyCheck = { ok: true } | { ok: false; reason: string };

export function checkCopy(raw: string, truth: TruthContext): CopyCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "vide" };
  if (/[<>{}]|https?:\/\/|www\.|\*\*|`|\[[^\]]*\]\(/.test(value)) return { ok: false, reason: "balisage ou lien" };
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(value) && !(truth.text.includes(normalize(value.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)![0])))) {
    return { ok: false, reason: "e-mail non vérifié" };
  }
  const text = normalize(value);

  for (const n of digits(text)) {
    if (!truth.numbers.has(n)) return { ok: false, reason: `nombre non vérifié (${n})` };
  }
  const since = text.match(/depuis ((?:19|20)\d\d)/);
  if (since && since[1] !== truth.foundedYear && !truth.text.includes(`depuis ${since[1]}`)) return { ok: false, reason: "année non vérifiée" };

  for (const rule of RULES) {
    if (rule.re.test(text) && !rule.allowed(truth, text)) return { ok: false, reason: rule.name };
  }

  for (const match of value.matchAll(/[«“"]\s*([^»”"]{3,240}?)\s*[»”"]/g)) {
    if (!truth.text.includes(normalize(match[1]).replace(/[….]+$/, ""))) return { ok: false, reason: "citation introuvable" };
  }

  const accentless = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const match of accentless.matchAll(new RegExp(LOCATIVE.source, "gu"))) {
    const place = normalize(match[1]);
    if (place.length >= 3 && !truth.text.includes(place)) return { ok: false, reason: `lieu non vérifié (${match[1]})` };
  }
  return { ok: true };
}

/** Walks every string of a value and returns the first refusal, if any. */
export function checkAllCopy(value: unknown, truth: TruthContext, skipKeys: Set<string> = new Set()): CopyCheck {
  if (typeof value === "string") return checkCopy(value, truth);
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = checkAllCopy(item, truth, skipKeys);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (skipKeys.has(key)) continue;
      const result = checkAllCopy(item, truth, skipKeys);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}
