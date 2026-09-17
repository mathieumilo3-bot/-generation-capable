// Configuration partagée par la page publique, le dashboard admin et
// l'onboarding. Une seule base, une seule table : public.setter_applications.
//
// La clé ci-dessous est la clé *publishable* : elle est conçue pour être
// exposée dans le navigateur. Ce qui protège réellement les candidatures, c'est
// la RLS Postgres (voir supabase/setter-admin.sql) : le rôle anon ne peut
// QU'INSÉRER, la lecture est réservée aux e-mails listés dans setter_admins.
export const SUPABASE_URL = 'https://wscuqzjhmpyytsczqbjb.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_i_WcXEjzpUPMRhzabs8FvA_6nZKQmwg';

// Garde-fou d'interface uniquement : affiche "accès refusé" sans attendre un
// aller-retour réseau. L'autorisation qui compte est celle de la RLS.
export const ADMIN_EMAILS = [
  'ledorvenenzo50@gmail.com',
];

export const APPLICATIONS_TABLE = 'setter_applications';

// Statuts "à traiter" : tout ce qui n'est ni accepté ni refusé.
export const PENDING_STATUSES = ['received', 'reviewing', 'test', 'interview'];

export const STATUS_LABELS = {
  received: 'Reçue',
  reviewing: 'En cours d’examen',
  test: 'Test envoyé',
  interview: 'Entretien',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

// Valeurs stockées par le formulaire public dans la colonne `availability`.
export const AVAILABILITY_LABELS = {
  immediate: 'Immédiatement',
  '2_weeks': 'Sous 2 semaines',
  '1_month': 'Sous 1 mois',
  later: 'Plus tard',
  unavailable: 'Indisponible',
};
