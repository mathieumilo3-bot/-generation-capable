const MESSAGES: Record<string, string> = {
  denied: "Connexion annulée : l'autorisation n'a pas été accordée.",
  state: "La connexion a expiré ou a été interrompue. Recommencez.",
  scopes: "Autorisations incomplètes : cochez l'envoi et la lecture des e-mails lors de la connexion.",
  offline: "Le fournisseur n'a pas accordé d'accès durable. Recommencez la connexion.",
  identity: "Impossible d'identifier la boîte mail connectée.",
  exchange: "La connexion à la boîte mail a échoué. Réessayez.",
  invalid_client: "Identifiants Google invalides : vérifiez le Client ID et surtout le Client Secret dans Netlify.",
  invalid_grant: "Google a refusé le code d’autorisation. Recommencez la connexion Gmail.",
  redirect_uri: "L’URL de redirection Google ne correspond pas à PrixChantier.",
  not_configured: "Cette messagerie n'est pas configurée sur le serveur.",
  rate_limited: "Trop de tentatives. Patientez quelques minutes.",
  no_org: "Créez d'abord votre entreprise.",
  provider: "Messagerie non prise en charge.",
};

export function mailErrorMessage(code: string | null | undefined) {
  if (!code) return null;
  return MESSAGES[code] ?? "La connexion à la boîte mail a échoué. Réessayez.";
}
