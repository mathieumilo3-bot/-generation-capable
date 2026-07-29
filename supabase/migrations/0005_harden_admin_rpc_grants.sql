-- ══════════════════════════════════════════════════════════════════════════
-- Durcissement complémentaire — admin_list_subscribers() / admin_set_subscriber_active()
-- ══════════════════════════════════════════════════════════════════════════
-- Le back-office (index.html) a été câblé sur ces deux fonctions (créées
-- dans 0003_document_live_production_schema.sql) pour de vrai lors du même
-- travail qui a révélé que le tableau "Membres inscrits" ne faisait
-- jusqu'ici RIEN (renderRealMembers() était un TODO vide). En retirant
-- explicitement EXECUTE à "anon" ici, on ferme le même trou que celui déjà
-- traité pour is_current_user_admin()/admin_cancel_commission()/
-- admin_mark_commission_paid() dans 0004_... : Supabase accorde EXECUTE par
-- défaut à anon sur toute nouvelle fonction, et ces deux-là s'auto-protègent
-- déjà en interne (vérification contre "admins") mais restaient
-- techniquement appelables sans authentification.
revoke all on function public.admin_list_subscribers() from anon;
revoke all on function public.admin_set_subscriber_active(uuid, boolean) from anon;
grant execute on function public.admin_list_subscribers() to authenticated;
grant execute on function public.admin_set_subscriber_active(uuid, boolean) to authenticated;
