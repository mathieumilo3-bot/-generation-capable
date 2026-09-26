/**
 * Double de test du modèle IA (aucune clé OpenAI dans l'environnement de test).
 * Il imite une extraction « parfaite mais honnête » à partir du texte reçu,
 * pour tester toute la chaîne (appels, schémas, rapprochement, comparatif).
 * La qualité réelle de l'extraction OpenAI n'est PAS testée par ce double.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function field<T>(value: T | null, excerpt: string | null = null) {
  return { value, confidence: value === null ? 0 : 0.9, source_excerpt: excerpt, page: value === null ? null : 1 };
}

function frDateToIso(d: string) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function classify(designation: string) {
  const d = designation.toLowerCase();
  const rules: [RegExp, string][] = [
    [/pompe à chaleur|chauffe-eau|ballon/, "Production chaud/froid"],
    [/radiateur|ventilo|sèche/, "Émetteurs"],
    [/centrale|cta/, "Ventilation / CTA"],
    [/gaine|bouche|diffuseur|clapet coupe|silencieux/, "Réseaux aérauliques"],
    [/tube|collecteur|colonne/, "Tuyauterie / réseaux"],
    [/vanne|robinet|mitigeur|soupape|clapet|réducteur|purgeur|groupe de sécurité/, "Robinetterie / vannes"],
    [/circulateur|pompe/, "Pompes / circulateurs"],
    [/régulation|sonde|automate/, "Régulation / GTB"],
    [/calorifuge|isolation/, "Calorifuge / isolation"],
    [/wc|lavabo|receveur|évier|urinoir|siphon/, "Appareils sanitaires"],
    [/câble|chemin de câbles|conduit/, "Câbles / conduits"],
    [/tableau/, "Distribution électrique"],
    [/prise|interrupteur|luminaire|downlight|bloc autonome|détecteur/, "Appareillage / éclairage"],
    [/baie|rj45|catégorie 6|vdi/, "Courants faibles"],
    [/mise en service|essais|doe|recette|formation/, "Études / essais / DOE"],
  ];
  return rules.find(([re]) => re.test(d))?.[1] ?? "Divers";
}

export function fakeStructured(name: string, text: string, hasPdf: boolean): unknown {
  if (name === "classement_lignes") {
    const json = text.slice(text.indexOf("["));
    const items = JSON.parse(json) as { i: number; designation: string }[];
    return {
      items: items.map((l) => ({
        i: l.i,
        category: classify(l.designation),
        supplier_required: !/mise en service|essais|doe|recette|formation/i.test(l.designation),
        subcontractor_required: /calorifuge|mise en service|recette/i.test(l.designation),
        confidence: 0.9,
      })),
    };
  }
  if (name === "lignes_dpgf") {
    const lines = text
      .split("\n")
      .map((l) => l.split(" | "))
      .filter((c) => c.length >= 4 && num(c[2]) !== null)
      .map((c) => ({ page: 1, lot: null, code: c[0], designation: c[1], description: null, quantity_text: c[2], unit_text: c[3], confidence: 0.9 }));
    return { lines };
  }
  if (name === "offre_fournisseur") {
    let body = text;
    if (hasPdf) {
      // Lecture « visuelle » simulée : le double connaît le contenu du scan de test.
      const scanned = readFileSync(join(__dirname, "../fixtures/files/devis-scanne.txt"), "utf8");
      body += `\n${scanned
        .split("\n")
        .map((l) => l.replace(/^(\S+)\s{2}(.+?)\s{2}(\d+(?:[.,]\d+)?) (\S+)\s{2}(\d+(?:[.,]\d+)?)$/, "$1 | $2 | $3 | $4 | $5"))
        .join("\n")}`;
    }
    const lines: Record<string, unknown>[] = [];
    for (const raw of body.split("\n")) {
      const row = raw.replace(/^L\d+: /, "");
      const c = row.split(" | ").map((x) => x.trim());
      if (c.length < 5) continue;
      // Formats rencontrés : ref | libellé | qté | unité | PU [| remise] | total
      const qty = num(c[2]);
      const pu = num(c[4]);
      if (qty === null || pu === null) continue;
      const total = num(c[c.length - 1]);
      const discount = c.length >= 7 && /%/.test(c[5]) ? c[5] : null;
      const label = c[1];
      lines.push({
        supplier_reference: c[0] || null,
        supplier_designation: label,
        quantity: qty,
        unit: c[3] || null,
        unit_price: pu,
        total_price: total !== pu ? total : Math.round(qty * pu * 100) / 100,
        discount,
        availability: null,
        delivery_delay: null,
        is_alternative: /variante|au lieu de|équivalent/i.test(label),
        alternative_note: /variante/i.test(label) ? label : null,
        is_fee: /frais|port|emballage/i.test(label),
        matched_request: null,
        match_confidence: 0,
        confidence: 0.9,
        page: 1,
      });
    }
    const refusal = /pas en mesure|déclin|ne pouvons pas|ne sommes pas/i.test(body) && !lines.length;
    const totalMatch = /Total HT : ([\d\s.,]+) EUR/.exec(body);
    const quote = /(Devis n° \S+|Offre \S+|Devis N° : \S+)/.exec(body);
    const quoteDate = /du (\d{2}\/\d{2}\/\d{4})|Date : (\d{2}\/\d{2}\/\d{4})/.exec(body);
    const until = /jusqu'au (\d{2}\/\d{2}\/\d{4})/.exec(body);
    const validityDays = /Validit[ée][^:]*: (\d+) jours/.exec(body);
    let validity: string | null = until ? frDateToIso(until[1]) : null;
    const qd = quoteDate ? frDateToIso(quoteDate[1] ?? quoteDate[2]) : null;
    if (!validity && validityDays && qd) {
      const d = new Date(`${qd}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + Number(validityDays[1]));
      validity = d.toISOString().slice(0, 10);
    }
    const delay = /D[ée]lai[^:]*: ([^\n|]+)|D[ée]lai : ([^\n|]+)/.exec(body);
    const exclusions = body.split("\n").filter((l) => /non compris|non incluse|hors fourniture|exclu/i.test(l)).map((l) => l.replace(/^L\d+: \s*\|?\s*/, "").trim());
    return {
      classification: refusal ? "refusal" : lines.length ? "offer" : "other",
      classification_reason: "double de test",
      quote_reference: field(quote ? quote[1] : null),
      quote_date: field(qd),
      validity_date: field(validity),
      validity_text: validityDays ? `${validityDays[1]} jours` : null,
      delivery_delay: field(delay ? (delay[1] ?? delay[2]).trim() : null),
      payment_terms: field(/paiement : ([^\n]+)/i.exec(body)?.[1] ?? null),
      delivery_cost: field(null),
      delivery_included: /livraison non incluse|transport factur/i.test(body) ? "no" : /franco/i.test(body) ? "yes" : "unknown",
      commissioning_included: /mise en service non compris/i.test(body) ? "no" : "unknown",
      total_ht: field(totalMatch ? num(totalMatch[1]) : null),
      currency: "EUR",
      exclusions,
      reservations: [],
      comments: null,
      lines,
    };
  }
  throw new Error(`Schéma inconnu pour le double IA : ${name}`);
}
