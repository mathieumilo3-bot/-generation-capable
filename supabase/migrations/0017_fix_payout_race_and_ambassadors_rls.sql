-- 0014_fix_payout_race_and_ambassadors_rls.sql
--
-- Deux failles trouvées en auditant la base avant le lancement public :
--
-- 1) request_payout() (0006, revu en 0008) lisait le solde disponible avec un
--    simple SELECT SUM(...), puis marquait les commissions correspondantes
--    'withdrawn' dans des requêtes séparées, SANS jamais verrouiller les
--    lignes entre les deux. Deux appels concurrents du même vendeur (double-
--    clic sur "Demander un retrait", deux onglets) lisaient donc le MÊME
--    solde disponible avant que l'un des deux ne passe les commissions à
--    'withdrawn' — créant DEUX lignes "payouts" pour le même montant, alors
--    qu'une seule était réellement adossée à des commissions soldées. Si un
--    admin validait les deux demandes (rien ne les distingue dans l'espace
--    admin), le vendeur était payé deux fois pour la même somme.
--    Fix : verrouiller (FOR UPDATE) les lignes de commissions concernées
--    AVANT de calculer le solde — sous READ COMMITTED, un verrou FOR UPDATE
--    fait attendre l'appel concurrent jusqu'au commit du premier, puis
--    réévalue sa condition WHERE sur la version déjà commitée (donc déjà
--    'withdrawn', donc exclue) : les deux appels ne peuvent plus jamais
--    compter deux fois la même commission.
--
-- 2) La table "ambassadors" avait des policies RLS self-service
--    (ambassadors_select_own / _insert_own / _update_own, définies en 0003)
--    qui contredisaient le design documenté ailleurs dans ce dépôt :
--    ambassador-data.js affirme explicitement être "la seule porte d'entrée
--    possible" vers cette table (RLS ne devant accorder AUCUN accès à
--    anon/authenticated, service_role uniquement) — exactement comme
--    ambassador-data.js l'a fait pour la clé anon avant son fix. Ces
--    policies permettaient à n'importe quel utilisateur connecté d'appeler
--    directement PATCH /rest/v1/ambassadors?user_id=eq.<lui-même> avec un
--    JSON "state" arbitraire (revenu affiché, missions marquées faites...),
--    en contournant complètement ambassador-data.js et sa validation. Aucune
--    autre partie du code (index.html, ambassadors.html) n'appelle jamais
--    supabase.from('ambassadors') directement — ambassador-data.js (qui
--    utilise déjà service_role, donc contourne RLS) reste le seul chemin
--    utilisé : ces policies n'ont donc aucun usage légitime à retirer.

create or replace function public.request_payout()
returns uuid
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_available integer;
  v_wallet_id uuid;
  v_payout_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if extract(day from now()) < 5 then
    raise exception 'Les retraits ne sont ouverts qu''à partir du 5 de chaque mois.';
  end if;

  -- Verrouille D'ABORD les lignes concernées (FOR UPDATE impossible à
  -- combiner avec SUM(), d'où ce verrouillage "à vide" avant le calcul du
  -- solde ci-dessous) : sérialise tout appel concurrent du même vendeur.
  perform 1 from public.commissions
    where seller_id = auth.uid() and status = 'pending' and available_at <= now()
    for update;
  perform 1 from public.commissions
    where seller_id = auth.uid() and status = 'debt'
    for update;

  select coalesce(sum(amount),0) into v_available
    from public.commissions
    where seller_id = auth.uid() and status = 'pending' and available_at <= now();
  v_available := v_available - coalesce((select sum(amount) from public.commissions where seller_id = auth.uid() and status = 'debt'), 0);

  if v_available <= 0 then raise exception 'Aucun solde disponible à retirer.'; end if;

  v_wallet_id := ensure_wallet(auth.uid());

  insert into public.payouts (wallet_id, seller_user_id, amount, status)
  values (v_wallet_id, auth.uid(), v_available, 'requested')
  returning id into v_payout_id;

  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'pending' and available_at <= now();
  -- Les lignes de dette (status='debt') sont soldées dans ce retrait : on les
  -- marque aussi 'withdrawn' pour qu'elles ne soient plus jamais déduites.
  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'debt';

  return v_payout_id;
end;
$$;
revoke all on function public.request_payout() from public;
revoke all on function public.request_payout() from anon;
grant execute on function public.request_payout() to authenticated;

drop policy if exists ambassadors_select_own on public.ambassadors;
drop policy if exists ambassadors_insert_own on public.ambassadors;
drop policy if exists ambassadors_update_own on public.ambassadors;
-- Aucune policy de remplacement pour anon/authenticated par design : RLS
-- activée (voir 0003) + aucune policy = accès total refusé à ces rôles.
-- ambassador-data.js (service_role, qui contourne RLS) reste le seul chemin.
