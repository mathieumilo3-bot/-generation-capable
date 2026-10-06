import { formatEuros } from "./money";

/**
 * Toute erreur répond à 3 questions (§43) :
 *  1. Que s'est-il passé ?  2. Mon argent est-il en sécurité ?  3. Que puis-je faire ?
 * Les codes viennent des RPC (`{ok:false, code}`), des exceptions SQL ou du réseau.
 * On n'affiche JAMAIS un message technique brut.
 */
export type ErrorAction =
  | "retry" | "topup" | "resume_upload" | "go_home" | "contact_support"
  | "reduce_files" | "sign_in" | "update_app" | "choose_other_payment" | "none";

export interface HumanError {
  title: string;
  detail: string;
  money: string | null; // « Aucun montant n'a été prélevé. » (null = sans objet)
  action: ErrorAction;
  actionLabel: string | null;
}

export interface ErrorContext {
  shortfallCents?: number;
  maxFiles?: number;
  maxBytes?: number;
}

const NO_CHARGE = "Aucun montant n'a été prélevé.";

export function humanizeError(code: string | undefined | null, ctx: ErrorContext = {}): HumanError {
  switch (code) {
    case "insufficient_funds":
      return {
        title: ctx.shortfallCents ? `Il manque ${formatEuros(ctx.shortfallCents)} pour créer cette vidéo.` : "Votre solde est insuffisant.",
        detail: "Ajoutez de l'argent : vous reviendrez directement à votre récapitulatif.",
        money: NO_CHARGE, action: "topup", actionLabel: "Ajouter de l'argent",
      };
    case "upload_interrupted":
    case "network_error":
    case "upload_missing":
      return {
        title: "L'envoi s'est interrompu.", detail: "Votre vidéo est toujours sur votre appareil.",
        money: NO_CHARGE, action: "resume_upload", actionLabel: "Reprendre l'envoi",
      };
    case "offline":
      return { title: "Vous êtes hors connexion.", detail: "Vos données sont en sécurité. Reconnectez-vous pour continuer.", money: null, action: "retry", actionLabel: "Réessayer" };
    case "uploads_incomplete":
      return { title: "Certains fichiers sont encore en cours d'envoi.", detail: "Patientez quelques instants avant de lancer la création.", money: NO_CHARGE, action: "none", actionLabel: null };
    case "no_files":
      return { title: "Ajoutez au moins une vidéo.", detail: "Nous en avons besoin pour réaliser le montage.", money: null, action: "none", actionLabel: null };
    case "references_required":
      return { title: "Ajoutez une vidéo de référence.", detail: "Le Mode Référence s'inspire du style d'un exemple que vous aimez.", money: null, action: "none", actionLabel: null };
    case "instructions_required":
      return { title: "Dites-nous ce que vous souhaitez.", detail: "Quelques mots suffisent.", money: null, action: "none", actionLabel: null };
    case "file_too_large":
      return { title: "Ce fichier est trop volumineux.", detail: ctx.maxBytes ? `La limite est de ${Math.round(ctx.maxBytes / 1024 ** 3 * 10) / 10} Go par fichier.` : "Choisissez un fichier plus léger.", money: null, action: "reduce_files", actionLabel: "Choisir un autre fichier" };
    case "total_too_large":
    case "too_many_files":
      return { title: "Vous avez atteint la limite de fichiers.", detail: ctx.maxFiles ? `${ctx.maxFiles} fichiers maximum par vidéo.` : "Retirez quelques fichiers.", money: null, action: "reduce_files", actionLabel: "Retirer des fichiers" };
    case "unsupported_format":
      return { title: "Ce format n'est pas pris en charge.", detail: "Utilisez une vidéo MP4 ou MOV.", money: null, action: "reduce_files", actionLabel: "Choisir un autre fichier" };
    case "mode_unsupported":
    case "format_unsupported":
    case "duration_unsupported":
    case "method_unavailable":
    case "pricing_unavailable":
      return { title: "Cette option n'est pas disponible pour le moment.", detail: "Choisissez une autre option ou réessayez plus tard.", money: NO_CHARGE, action: "go_home", actionLabel: "Retour" };
    case "already_submitted":
    case "job_in_progress":
      return { title: "Une création est déjà en cours pour cette vidéo.", detail: "Vous serez prévenu dès qu'elle sera prête.", money: "Vous n'avez été débité qu'une seule fois.", action: "go_home", actionLabel: "Voir l'avancement" };
    case "maintenance":
      return { title: "Maintenance en cours.", detail: "Vos vidéos et votre solde sont en sécurité. Réessayez dans quelques minutes.", money: NO_CHARGE, action: "retry", actionLabel: "Réessayer" };
    case "account_suspended":
      return { title: "Votre compte est suspendu.", detail: "Contactez le support pour en savoir plus.", money: null, action: "contact_support", actionLabel: "Contacter le support" };
    case "wallet_unavailable":
      return { title: "Votre solde est momentanément indisponible.", detail: "Contactez le support : vos fonds ne sont pas affectés.", money: "Votre argent est en sécurité.", action: "contact_support", actionLabel: "Contacter le support" };
    case "rate_limited":
      return { title: "Trop de tentatives.", detail: "Patientez une minute avant de réessayer.", money: null, action: "retry", actionLabel: "Réessayer" };
    case "not_authenticated":
      return { title: "Votre session a expiré.", detail: "Reconnectez-vous : vos projets vous attendent.", money: null, action: "sign_in", actionLabel: "Se reconnecter" };
    case "app_outdated":
      return { title: "Mettez l'application à jour.", detail: "Cette version n'est plus prise en charge.", money: null, action: "update_app", actionLabel: "Mettre à jour" };
    case "payment_failed":
    case "card_declined":
      return { title: "Le paiement n'a pas pu être validé.", detail: "Vous pouvez réessayer ou utiliser un autre moyen de paiement.", money: "Votre solde n'a pas été modifié.", action: "retry", actionLabel: "Réessayer" };
    case "payment_requires_action":
      return { title: "Votre banque demande une confirmation.", detail: "Terminez la validation pour finaliser le paiement.", money: "Votre solde n'a pas été modifié.", action: "retry", actionLabel: "Continuer" };
    case "amount_too_low":
      return { title: "Montant trop faible.", detail: "Choisissez un montant supérieur au minimum de recharge.", money: null, action: "none", actionLabel: null };
    case "reauth_required":
      return { title: "Confirmez que c'est bien vous.", detail: "Pour votre sécurité, saisissez le code envoyé par e-mail avant de continuer.", money: null, action: "sign_in", actionLabel: "Recevoir un code" };
    case "revision_unsupported":
      return { title: "Cette modification n'est pas encore possible.", detail: "Essayez : plus court, plus rapide, plus lent, plus ou moins de zooms.", money: NO_CHARGE, action: "none", actionLabel: null };
    case "transfer_ownership_first":
      return { title: "Transférez d'abord la propriété de votre équipe.", detail: "Vous êtes propriétaire d'une équipe avec d'autres membres.", money: null, action: "contact_support", actionLabel: "Contacter le support" };
    case "invalid_invitation":
      return { title: "Cette invitation n'est plus valide.", detail: "Elle a peut-être expiré ou déjà été utilisée.", money: null, action: "contact_support", actionLabel: "Contacter le support" };
    default:
      return { title: "Un problème est survenu.", detail: "Réessayez dans un instant. Si cela continue, contactez le support.", money: "Votre argent est en sécurité.", action: "retry", actionLabel: "Réessayer" };
  }
}

/** Extrait un code lisible d'une erreur PostgREST/Supabase ou d'un `{ok:false}`. */
export function errorCodeOf(err: unknown): string {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  const e = err as { code?: unknown; message?: unknown; name?: unknown; status?: unknown };
  const msg = typeof e.message === "string" ? e.message : "";
  const known = [
    "insufficient_funds", "rate_limited", "not_authenticated", "account_suspended", "forbidden",
    "maintenance", "idempotency_key_required", "wallet_unavailable", "transfer_ownership_first",
  ];
  for (const k of known) if (msg.includes(k)) return k;
  if (msg.includes("Failed to fetch") || msg.includes("Network request failed") || e.name === "TypeError") return "network_error";
  if (e.status === 401 || msg.includes("JWT")) return "not_authenticated";
  return typeof e.code === "string" && /^[a-z_]+$/.test(e.code) ? e.code : "unknown";
}
