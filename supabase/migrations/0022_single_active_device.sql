-- 0022_single_active_device.sql
--
-- Un seul appareil connecté à la fois par compte.
--
-- OBJECTIF
--   Empêcher qu'un abonnement à 67 €/mois soit partagé entre plusieurs
--   personnes. Sans cela, un seul compte peut servir à dix vendeurs.
--
-- RÈGLE RETENUE : "le dernier appareil gagne".
--   Se connecter ailleurs déconnecte l'appareil précédent, plutôt que de
--   refuser la nouvelle connexion. C'est le comportement des services de
--   streaming, et surtout il ne peut jamais enfermer un client dehors :
--   quelqu'un qui change de téléphone, vide son navigateur ou perd son
--   appareil se reconnecte normalement, sans intervention du support.
--
--   Le refus de la nouvelle connexion aurait l'effet inverse : un client
--   légitime bloqué, et une demande de support à chaque changement
--   d'appareil.
--
-- Écrit et lu exclusivement par netlify/functions/session-guard.js.

create table if not exists public.active_devices (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  device_id    text not null,
  user_agent   text,
  claimed_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Aucun accès direct depuis le navigateur : tout passe par la fonction
-- Netlify session-guard, en service_role, après vérification du jeton de
-- session. Sinon n'importe qui pourrait revendiquer l'appareil d'un autre
-- compte et le déconnecter en boucle.
alter table public.active_devices enable row level security;
revoke all on public.active_devices from anon, authenticated;

comment on table public.active_devices is
  'Appareil actuellement autorisé pour chaque compte. Une nouvelle connexion remplace la ligne : l''appareil précédent est déconnecté à sa prochaine vérification.';
