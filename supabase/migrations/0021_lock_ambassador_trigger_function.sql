-- 0021_lock_ambassador_trigger_function.sql
--
-- credit_ambassador_on_order_paid() (migration 0020) est SECURITY DEFINER :
-- elle écrit dans ambassador_earnings avec les droits du propriétaire.
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création de TOUTE
-- fonction, y compris les fonctions de trigger. La migration 0020 révoquait
-- explicitement ce droit sur les quatre fonctions de statistiques mais avait
-- laissé celle-ci ouverte à anon/authenticated — relevé en repassant
-- l'analyseur de sécurité Supabase après déploiement.
--
-- Révoquer ces droits n'empêche PAS le trigger de se déclencher : un trigger
-- s'exécute avec les droits du propriétaire de la table, sans contrôle du
-- privilège EXECUTE de l'appelant. Le crédit des 50 € continue donc de
-- fonctionner à l'identique.

revoke all on function public.credit_ambassador_on_order_paid()
  from public, anon, authenticated;
