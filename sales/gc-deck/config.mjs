/**
 * GC sales deck — the ONE place to adapt the deck to a prospect.
 *
 *   node sales/gc-deck/build.mjs --out=<dir>                       FULL DECK
 *   node sales/gc-deck/build.mjs --offer=conversion --out=<dir>    GC CONVERSION
 *   node sales/gc-deck/build.mjs --offer=acquisition --out=<dir>   GC ACQUISITION
 *   node sales/gc-deck/build.mjs --offer=growth --out=<dir>        GC GROWTH SYSTEM
 *
 * `--offer` plays the role of `?offer=` : the Slides format runs no script,
 * so the variant is produced at build time — the slides that do not belong
 * to the chosen mode are marked `hidden` (kept in the editor, skipped when
 * presenting or exporting).
 *
 * Honesty rules (never relax them here): no revenue, ROI, traffic, review,
 * client or testimonial goes into this file unless it was measured or
 * collected. A demonstration stays labelled "Démonstration GC".
 */
export default {
  /** "full" | "conversion" | "acquisition" | "growth" — overridden by --offer. */
  offer: "full",

  /** Leave prospectCompany null for the generic deck: the two "Pour vous" slides are then hidden. */
  prospectCompany: null,
  prospectSector: null,
  /** One sentence, in the prospect's own terms. */
  prospectProblem: null,

  /** The 4 blocks of the "Pour [entreprise]" slide — three short lines each, at most. */
  diagnosis: {
    works: [],
    slows: [],
    missing: [],
    build: [],
  },

  /** Offer recommended on the "Système recommandé" slide (defaults to `offer`, or conversion). */
  selectedOffer: null,

  /**
   * Proof slides shown per mode. Ids from slides.mjs. Add a real client's
   * slides here once they exist; never promote a demonstration to a client.
   */
  selectedProof: {
    full: ["statuts", "kerne", "cc-projet", "cc-mobile", "cc-portfolio", "cc-qualification"],
    conversion: ["statuts", "kerne", "cc-projet", "cc-mobile", "cc-portfolio", "cc-qualification"],
    acquisition: ["statuts", "cc-projet", "cc-qualification"],
    growth: ["statuts", "kerne", "cc-projet", "cc-mobile", "cc-portfolio", "cc-qualification"],
  },

  /** Price shown on the recommendation slide; null = the offer's public range. */
  price: null,

  /** "diagnostic" when the deck is sent; "meeting" when it is presented live. */
  ctaMode: "diagnostic",
  cta: {
    diagnostic: { label: "Recevoir mon diagnostic", url: "https://generationcapable.fr/audit" },
    meeting: { label: "Construire le système", url: "https://generationcapable.fr/audit" },
  },

  offers: {
    conversion: {
      code: "S-01",
      name: "GC Conversion",
      forWhom: "Vous obtenez déjà de l'attention, mais votre parcours convertit mal.",
      result: "Transformer davantage d'attention existante en conversations commerciales.",
      components: ["Site / Landing", "UX", "Message", "Preuves", "Qualification", "CTA", "RDV"],
      price: "1 290 € → 3 490 €",
      priceNote: "Projet, selon périmètre",
    },
    acquisition: {
      code: "S-02",
      name: "GC Acquisition",
      forWhom: "Votre mécanique commerciale tient, mais les demandes manquent.",
      result: "Créer un flux mesurable de prospects qualifiés.",
      components: ["Google Ads", "SEO local", "Landing pages", "Tracking", "Pilotage de l'acquisition"],
      price: "690 € → 990 € / mois",
      priceNote: "Abonnement · setup selon besoin",
    },
    growth: {
      code: "S-03",
      name: "GC Growth System",
      forWhom: "Vous voulez l'infrastructure complète, pilotée dans la durée.",
      result: "Relier acquisition, conversion, suivi et données en un seul système.",
      components: ["Acquisition", "Conversion", "Qualification", "CRM", "Suivi", "Automatisation", "Data"],
      price: "2 490 € → 3 990 €+ puis 990 € → 1 490 € / mois+",
      setup: "2 490 € → 3 990 €+",
      monthly: "990 € → 1 490 € / mois+",
      priceNote: "Setup, puis abonnement",
    },
  },

  /**
   * Uploaded images (asset urls of the published deck). Real captures of the
   * Clos & Cadre demonstration. Kerné captures: drop them on the Kerné slide
   * in the editor, or upload them and add their urls here.
   */
  assets: {
    ccDesktopHero: "/_blob/41cd6ea8e627dedcde7649f998342054",
    ccDesktopProject: "/_blob/bf837abe44aaed6cb97ee96083138e04",
    ccDesktopRealisations: "/_blob/35e27fee0551f2aa0a144c1ab581747c",
    ccFiche: "/_blob/7db393d8aba96208cf9d9ee6f5ec32a6",
    ccFormStep3: "/_blob/930457e16f6fa6fc8548c7b85ff87de2",
    ccMobileForm: "/_blob/dd19c0702d3156d6f7f78d1beafe818a",
    ccMobileHero: "/_blob/34c9c72d00f6f505d4d4e7151bd4cfcc",
    ccMobileRealisations: "/_blob/df04320929fb87a6d1ed48fca1387380",
    ccSlider: "/_blob/afd52613cf03363fb3168f98591be5e5",
    kerneBefore: null,
    kerneAfter: null,
  },
  /** Kerné's status: "realisation" | "etude" | "demonstration" | null (unconfirmed). */
  kerneStatus: null,
};
