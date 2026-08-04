-- 0023_referral_clicks_retention.sql
--
-- Purge automatique des vieux clics de parrainage.
--
-- POURQUOI
--   referral_clicks (migration 0020) reçoit une ligne par visiteur et par
--   lien. Sans purge, la table grossit indéfiniment : à 10 000 visites par
--   jour, cela fait ~3,6 millions de lignes par an. Le tableau de bord de
--   chaque ambassadeur fait un count(distinct visitor_hash) dessus — une
--   opération dont le coût augmente avec le volume. Le site ne casserait pas
--   d'un coup : il ralentirait progressivement, ce qui est bien plus
--   difficile à diagnostiquer six mois plus tard.
--
--   C'est aussi une bonne pratique RGPD : on ne conserve pas indéfiniment des
--   traces de navigation dont plus personne n'a l'usage.
--
-- CHOIX DE LA DURÉE : 24 mois.
--   Assez long pour comparer une année à la précédente, assez court pour que
--   la table reste petite. Les GAINS (ambassador_earnings) ne sont JAMAIS
--   purgés : ce sont des données comptables, elles doivent rester.
--
-- Appelée une fois par jour par netlify/functions/cron-ambassador-earnings.js,
-- en fin de traitement et sans bloquer le crédit des gains en cas d'échec.

create or replace function public.purge_old_referral_clicks(
  p_keep_months integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_deleted integer;
begin
  -- Garde-fou : une valeur trop basse effacerait des statistiques encore
  -- utiles. On refuse de descendre sous 6 mois, même si l'appelant insiste.
  if p_keep_months is null or p_keep_months < 6 then
    p_keep_months := 6;
  end if;

  delete from public.referral_clicks
  where occurred_at < now() - make_interval(months => p_keep_months);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end $fn$;

-- SECURITY DEFINER : appelable uniquement par le service_role, donc
-- exclusivement depuis une fonction Netlify. PostgreSQL accorde EXECUTE à
-- PUBLIC par défaut à la création — d'où ce retrait explicite (voir 0021,
-- même oubli corrigé sur la fonction du trigger de gains).
revoke all on function public.purge_old_referral_clicks(integer) from public, anon, authenticated;
grant execute on function public.purge_old_referral_clicks(integer) to service_role;
