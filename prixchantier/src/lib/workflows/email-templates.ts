import { longDate } from "@/lib/format";

/**
 * Textes des e-mails : courts, opérationnels, sans engagement.
 * Génération déterministe (pas d'IA) : l'utilisateur relit et modifie
 * toujours le premier envoi avant validation.
 */

export function consultationSubject(input: { projectName: string; projectReference: string | null; referenceCode: string }) {
  const ref = input.projectReference ? ` (${input.projectReference})` : "";
  return `Demande de prix – ${input.projectName}${ref} [${input.referenceCode}]`;
}

export function consultationBody(input: {
  projectName: string;
  client: string | null;
  dueDate: string | null;
  lineCount: number;
  senderName: string | null;
  organizationName: string;
  withExcel: boolean;
}) {
  const chantier = input.client ? `${input.projectName} (${input.client})` : input.projectName;
  const lines = [
    "Bonjour,",
    "",
    `Dans le cadre du chantier ${chantier}, pourriez-vous nous transmettre votre meilleure proposition concernant les éléments joints (${input.lineCount} ligne${input.lineCount > 1 ? "s" : ""}) ?`,
    "",
  ];
  if (input.dueDate) lines.push(`Retour souhaité avant le ${longDate(input.dueDate)}.`, "");
  lines.push(
    "Merci d'indiquer si possible :",
    "- prix ;",
    "- délai ;",
    "- disponibilité ;",
    "- validité de l'offre ;",
    "- conditions de livraison.",
    "",
  );
  if (input.withExcel) {
    lines.push("Vous pouvez compléter directement le fichier Excel joint, ou nous envoyer votre propre devis.", "");
  }
  lines.push("Bien cordialement,", "", ...[input.senderName, input.organizationName].filter((x): x is string => Boolean(x)));
  return lines.join("\n");
}

export function followupBody(input: {
  projectName: string;
  attempt: number;
  dueDate: string | null;
  senderName: string | null;
  organizationName: string;
}) {
  const lines = ["Bonjour,", ""];
  if (input.attempt <= 1) {
    lines.push(`Petite relance concernant notre demande de prix pour le chantier ${input.projectName}.`);
  } else {
    lines.push(`Je me permets de revenir vers vous concernant notre demande de prix pour le chantier ${input.projectName}.`);
  }
  lines.push("", "Pouvez-vous nous confirmer si vous pourrez nous transmettre une offre ?");
  if (input.dueDate) lines.push(`Notre date de retour souhaitée est le ${longDate(input.dueDate)}.`);
  lines.push("", "Merci.", "", ...[input.senderName, input.organizationName].filter((x): x is string => Boolean(x)));
  return lines.join("\n");
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReferenceCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PC-${Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}

/** Référence PrixChantier présente dans un objet de mail. */
export function referenceInSubject(subject: string): string | null {
  const m = /\bPC-[A-Z0-9]{6}\b/.exec(subject.toUpperCase());
  return m ? m[0] : null;
}

/** Réponse automatique (absence, accusé) : ne vaut pas réponse fournisseur. */
export function looksLikeAutoReply(subject: string, body: string) {
  return /r[ée]ponse automatique|absence|out of office|automatic reply|auto[- ]?reply|accus[ée] de r[ée]ception|undeliverable|non remis|delivery status notification/i.test(
    `${subject}\n${body.slice(0, 400)}`,
  );
}

/**
 * Prochaine échéance de relance : +48 h (1re) puis +72 h, décalée au jour
 * ouvré suivant à 9 h (heure de Paris) si elle tombe un week-end.
 */
export function followupDueDate(from: Date, attempt: number): Date {
  const due = new Date(from.getTime() + (attempt <= 1 ? 48 : 72) * 3_600_000);
  const parisDay = () =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/Paris" }).format(due);
  let shifted = false;
  while (["Sat", "Sun"].includes(parisDay())) {
    due.setTime(due.getTime() + 24 * 3_600_000);
    shifted = true;
  }
  if (shifted) {
    // 9 h à Paris : 07:00 ou 08:00 UTC selon l'heure d'été.
    const offset = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
        .formatToParts(due)
        .find((p) => p.type === "timeZoneName")
        ?.value.replace("GMT", "") || "1",
    );
    due.setUTCHours(9 - offset, 0, 0, 0);
  }
  return due;
}

/** Jour calendaire à Paris (AAAA-MM-JJ) — sert à la règle « une relance par jour maximum ». */
export function parisDay(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(d);
}
