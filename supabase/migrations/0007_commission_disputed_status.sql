-- ══════════════════════════════════════════════════════════════════════════
-- Ajoute le statut 'disputed' (litige Stripe) aux commissions
-- ══════════════════════════════════════════════════════════════════════════
-- stripe-webhook.js gèle désormais une commission (statut 'disputed',
-- exclue du solde disponible/en attente) sur réception de
-- charge.dispute.created, plutôt que de la laisser comptée normalement
-- pendant l'instruction du litige par Stripe. Résolution manuelle par
-- l'admin ensuite (Stripe ne notifie pas de façon fiable/automatisable une
-- résolution positive du litige).
alter table public.commissions drop constraint if exists commissions_status_check;
alter table public.commissions add constraint commissions_status_check
  check (status in ('pending','validated','paid','cancelled','refunded','debt','withdrawn','disputed'));
