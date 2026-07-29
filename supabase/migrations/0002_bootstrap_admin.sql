-- ══════════════════════════════════════════════════════════════════════════
-- Amorce le compte admin — à exécuter une fois, après 0001_subscribers_roles_and_rls.sql
-- ══════════════════════════════════════════════════════════════════════════
-- Insère (ou met à jour) la ligne "subscribers" pour ton email avec
-- role='admin'. L'accès admin (netlify/functions/admin-verify.js) ne dépend
-- que de cet email vérifié par Supabase Auth au moment de la connexion —
-- peu importe que cette ligne existe avant ou après ta première connexion
-- sur le site avec cette adresse.
--
-- is_active = true est inclus pour que ton propre compte ait aussi accès au
-- contenu payant (pratique pour tester le parcours membre en plus du
-- back-office). Mets false si tu préfères garder les deux séparés.
insert into public.subscribers (email, role, is_active, plan)
values (lower('ledorvenenzo50@gmail.com'), 'admin', true, 'gc_67')
on conflict (email) do update set role = 'admin';

-- Vérification :
--   select email, role, is_active from public.subscribers where role = 'admin';
