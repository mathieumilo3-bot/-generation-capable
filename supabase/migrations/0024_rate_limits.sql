-- 0024_rate_limits.sql
--
-- Limitation de débit des points d'entrée publics.
--
-- POURQUOI EN BASE ET NON EN MÉMOIRE
--   Les fonctions Netlify sont éphémères et multipliées à la demande : un
--   compteur gardé en mémoire ne verrait qu'une fraction du trafic et
--   n'arrêterait rien. Le compteur doit être partagé — donc en base.
--
-- CE QUE ÇA PROTÈGE
--   • referral-track : un ambassadeur pourrait marteler son propre lien pour
--     gonfler ses statistiques de clics et paraître plus performant qu'il ne
--     l'est. Aucune conséquence financière directe (seul un abonnement payé
--     rapporte), mais des chiffres faux faussent les décisions.
--   • capture-lead : sans limite, n'importe qui peut noyer la base de
--     prospects de milliers de fausses adresses, rendant l'outil inutilisable
--     et abîmant la réputation d'envoi du domaine.
--
-- La fenêtre glisse par tranches fixes : simple, sans tâche de nettoyage
-- permanente, et suffisant pour arrêter un flood.
--
-- Vérifié après application : 3 appels normaux passent, 60 appels contre une
-- limite de 40 donnent exactement 40 passages et 20 blocages, et un autre
-- visiteur n'est pas impacté par le flood du premier.

create table if not exists public.rate_limits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Incrémente le compteur et dit si l'appel est autorisé.
-- Renvoie true si l'appel passe, false s'il dépasse la limite.
create or replace function public.rate_limit_check(
  p_key            text,
  p_max_hits       integer default 30,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_key is null or p_key = '' then
    return true;   -- pas d'identifiant exploitable : on ne bloque pas
  end if;

  -- Début de la tranche courante (ex: tranches de 60 s alignées).
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (bucket_key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Purge opportuniste des tranches anciennes, une fois sur cent environ :
  -- évite une table qui grossit sans fin, sans imposer un cron dédié ni
  -- ralentir chaque appel.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_hits <= p_max_hits;
end $fn$;

revoke all on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;
