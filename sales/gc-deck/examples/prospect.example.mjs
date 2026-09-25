/**
 * Example of a prospect configuration. Copy it, fill it after the diagnostic,
 * then: node sales/gc-deck/build.mjs --config=<your copy> --out=<dir>
 * Everything below is an illustrative placeholder, not a real company.
 */
import base from "../config.mjs";

export default {
  ...base,
  offer: "conversion",
  prospectCompany: "[Entreprise]",
  prospectSector: "[Secteur]",
  prospectProblem: "[Une phrase, dans les mots du prospect : ce qui bloque aujourd'hui.]",
  diagnosis: {
    works: ["[Ce qui attire déjà des demandes]"],
    slows: ["[Le passage où les prospects décrochent]"],
    missing: ["[La preuve ou l'étape absente]"],
    build: ["[Ce que GC construirait en premier]"],
  },
  selectedOffer: "conversion",
  ctaMode: "meeting",
};
