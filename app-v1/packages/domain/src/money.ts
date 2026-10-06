/**
 * Argent : TOUJOURS des centimes entiers (§9, §11). Jamais de float stocké ni
 * transmis ; la conversion en euros n'existe que pour l'affichage/la saisie.
 */
export type Cents = number;

export function assertCents(n: number): Cents {
  if (!Number.isSafeInteger(n)) throw new Error(`Montant invalide (centimes entiers requis) : ${n}`);
  return n;
}

const NBSP = " ";

/** 2640 → "26,40 €" (espace insécable avant € ; séparateur de milliers = espace fine insécable). */
export function formatEuros(cents: Cents, opts: { signed?: boolean; compact?: boolean } = {}): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const intPart = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = opts.compact && rest === 0 ? intPart : `${intPart},${String(rest).padStart(2, "0")}`;
  const sign = cents < 0 ? "−" : opts.signed && cents > 0 ? "+" : "";
  return `${sign}${body}${NBSP}€`;
}

/**
 * Saisie libre → centimes. Accepte "12", "12,5", "12.50", "1 250,00", "12 €".
 * Retourne null si invalide, négatif, ou avec plus de 2 décimales.
 */
export function parseEurosInput(input: string): Cents | null {
  const cleaned = input.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [i = "0", d = ""] = cleaned.split(".");
  const cents = parseInt(i, 10) * 100 + parseInt(d.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 1000 → "10" ; 1250 → "12,50" (pour pré-remplir un champ de saisie). */
export function centsToInput(cents: Cents): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
}

/** Conversion µ€ → centimes (arrondi supérieur : on ne sous-estime jamais un coût). */
export function microToCentsCeil(micro: number): Cents {
  return Math.ceil(micro / 10_000);
}
