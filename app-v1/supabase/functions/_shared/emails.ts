/**
 * E-mails transactionnels (§39) : blancs, sobres, un seul bouton, aucun pixel de suivi, aucun marketing.
 * Pur et testé : toutes les variables sont échappées.
 */
export type EmailKind = "welcome" | "video_ready" | "revision_ready" | "job_failed" | "topup_done" | "payment_failed" | "account_deleted" | "invitation";

export interface EmailVars {
  brand: string;
  supportEmail: string;
  firstName?: string | null;
  ctaUrl?: string | null;
  amountLabel?: string | null;
  receiptUrl?: string | null;
  inviterName?: string | null;
  /** Durée de conservation des vidéos (heures) : rappelée dans les e-mails de livraison. */
  retentionHours?: number;
}

export interface RenderedEmail { subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u?: string | null) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

interface Content { subject: string; title: string; paragraphs: string[]; cta?: string; note?: string }

function content(kind: EmailKind, v: EmailVars): Content {
  const hello = v.firstName ? `Bonjour ${v.firstName},` : "Bonjour,";
  switch (kind) {
    case "welcome":
      return { subject: `Bienvenue sur ${v.brand}`, title: "Bienvenue", paragraphs: [hello, "Votre compte est prêt. Envoyez vos vidéos, choisissez la durée : nous nous occupons du montage.", "Vous retrouverez toujours votre travail et votre solde dans l'application."], cta: "Créer ma première vidéo" };
    case "video_ready":
      return { subject: "Votre vidéo est prête", title: "Votre vidéo est prête", paragraphs: [hello, "Le montage est terminé. Vous pouvez la regarder et la télécharger.", v.retentionHours ? `Pour votre confidentialité, elle est supprimée ${v.retentionHours} h après sa création : pensez à la télécharger.` : ""].filter(Boolean), cta: "Voir ma vidéo" };
    case "revision_ready":
      return { subject: "Votre nouvelle version est prête", title: "Votre nouvelle version est prête", paragraphs: [hello, "La version modifiée est disponible.", v.retentionHours ? `Elle est supprimée ${v.retentionHours} h après sa création : pensez à la télécharger.` : ""].filter(Boolean), cta: "Voir la nouvelle version" };
    case "job_failed":
      return { subject: "Votre rendu n'a pas pu être terminé", title: "Votre rendu n'a pas pu être terminé", paragraphs: [hello, "Nous n'avons pas pu terminer votre vidéo. Aucun montant n'a été prélevé : la somme réservée a été libérée.", "Vous pouvez relancer la création ou contacter notre support depuis l'application."], cta: "Ouvrir l'application" };
    case "topup_done":
      return { subject: "Recharge confirmée", title: "Recharge confirmée", paragraphs: [hello, `${v.amountLabel ? `${v.amountLabel} ont` : "Votre recharge a"} été ajouté${v.amountLabel ? "s" : "e"} à votre solde.`], cta: "Voir mon solde", note: v.receiptUrl ? "Votre reçu est disponible via le lien ci-dessous." : undefined };
    case "payment_failed":
      return { subject: "Le paiement n'a pas pu être validé", title: "Le paiement n'a pas pu être validé", paragraphs: [hello, "Votre solde n'a pas été modifié. Vous pouvez réessayer ou utiliser un autre moyen de paiement."], cta: "Réessayer" };
    case "account_deleted":
      return { subject: "Votre compte a été supprimé", title: "Votre compte a été supprimé", paragraphs: [hello, "Vos projets, fichiers et données personnelles ont été supprimés.", "Conformément à nos obligations comptables, seuls les justificatifs de paiement, anonymisés, sont conservés."] };
    case "invitation":
      return { subject: `${v.inviterName ?? v.brand} vous invite sur ${v.brand}`, title: "Votre invitation", paragraphs: [hello, "Votre espace est prêt. Créez votre compte en un instant : votre solde offert s'y trouve déjà."], cta: "Créer mon compte" };
  }
}

export function renderEmail(kind: EmailKind, v: EmailVars): RenderedEmail {
  const c = content(kind, v);
  const url = safeUrl(v.ctaUrl);
  const receipt = safeUrl(v.receiptUrl);
  const p = c.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:17px;line-height:24px;color:#1D1D1F">${esc(t)}</p>`).join("");
  const button = c.cta && url
    ? `<p style="margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#FF3B30;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:17px;padding:16px 28px;border-radius:20px">${esc(c.cta)}</a></p>` : "";
  const receiptHtml = receipt ? `<p style="margin:0 0 16px;font-size:15px"><a href="${esc(receipt)}" style="color:#6E6E73">Télécharger le reçu</a></p>` : "";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="margin:0 0 32px;font-size:15px;font-weight:600;color:#FF3B30">${esc(v.brand)}</p>
<h1 style="margin:0 0 20px;font-size:28px;line-height:34px;color:#1D1D1F">${esc(c.title)}</h1>
${p}${button}${receiptHtml}
<hr style="border:none;border-top:1px solid #E5E5EA;margin:32px 0 16px">
<p style="margin:0;font-size:13px;line-height:18px;color:#6E6E73">Une question ? Écrivez-nous : <a href="mailto:${esc(v.supportEmail)}" style="color:#6E6E73">${esc(v.supportEmail)}</a></p>
</div></body></html>`;
  const text = [c.title, "", ...c.paragraphs, ...(c.cta && url ? ["", `${c.cta} : ${url}`] : []), ...(receipt ? ["", `Reçu : ${receipt}`] : []), "", `Support : ${v.supportEmail}`].join("\n");
  return { subject: c.subject, html, text };
}
