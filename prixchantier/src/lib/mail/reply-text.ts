/**
 * Analyse du texte d'une réponse fournisseur.
 *
 * Adapté de `-commercial-radar/netlify/functions/lib/outreach-brain.mts`
 * (replyHead) : on isole ce que le fournisseur a écrit, sans le message
 * d'origine cité en dessous. Complété pour les formats rencontrés en BTP :
 * Gmail français (en-tête « a écrit » coupé sur deux lignes), Outlook
 * (« De : / Envoyé : », « -----Message d'origine----- »), Apple Mail.
 * Le corps complet reste toujours stocké : seule l'analyse utilise l'extrait.
 */

const QUOTE_MARKERS: RegExp[] = [
  /^>+/m,
  /^On .+(\n.+)?wrote:\s*$/im,
  /^Le .+(\n.+)?a [ée]crit\s*:\s*$/im,
  /^-{2,}\s*(Original Message|Message d'origine|Message original)\s*-{2,}\s*$/im,
  /^_{5,}\s*$/m,
  /^(De|From)\s*:\s*.+\n(\s*(Envoy[ée]|Sent|Date)\s*:)/im,
];

/** Partie rédigée par l'expéditeur, sans la citation du message précédent. */
export function replyHead(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  let cut = normalized.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(normalized);
    if (match?.index != null && match.index > 0) cut = Math.min(cut, match.index);
  }
  return normalized.slice(0, cut).trim() || normalized.slice(0, 1200).trim();
}

/** Réponse automatique (absence, accusé de réception) : ne vaut pas réponse. */
export function looksLikeAutoReply(subject: string, body: string) {
  return /r[ée]ponse automatique|absen(ce|t)|out of office|automatic reply|auto[- ]?reply|accus[ée] de r[ée]ception|en cong[ée]s?/i.test(
    `${subject}\n${replyHead(body).slice(0, 400)}`,
  );
}

/**
 * Avis de non-remise (adresse inexistante, boîte pleine, domaine introuvable).
 * Concept repris de la liste de suppression de -commercial-radar : une
 * adresse en échec n'est plus jamais relancée automatiquement.
 */
export function looksLikeBounce(fromEmail: string, subject: string) {
  const sender = fromEmail.toLowerCase();
  if (/^(mailer-daemon|postmaster|mail-daemon)@/.test(sender)) return true;
  return /delivery status notification \((failure|échec)\)|undeliverable|undelivered mail|non remis|échec de (la )?remise|mail delivery (failed|subsystem)|returned mail|delivery has failed|remise impossible/i.test(
    subject,
  );
}
