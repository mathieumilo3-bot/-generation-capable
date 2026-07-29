-- ══════════════════════════════════════════════════════════════════════════
-- Bloque la déclaration manuelle de production/livré/terminé par le vendeur
-- ══════════════════════════════════════════════════════════════════════════
-- advance_prospect_stage() (migration 0006) bloquait déjà explicitement
-- 'paid', mais laissait passer 'production', 'delivered' et 'done' sans
-- aucune restriction pour un vendeur normal — alors que ces trois étapes
-- sont censées être exclusivement pilotées par sign_and_lock_order()
-- (production) et admin_set_order_status() (delivered/done, équipe
-- studio). Un vendeur pouvait donc se déclarer "Terminé" sans qu'aucune
-- commande n'ait jamais été signée ni livrée, faussant le tableau de bord
-- admin de production et ses propres statistiques.
--
-- Un administrateur garde la main (correction manuelle possible en support),
-- seul un vendeur normal (non-admin) est bloqué sur ces étapes.
create or replace function public.advance_prospect_stage(p_prospect_id uuid, p_new_stage text, p_justification text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_seller_id uuid;
  v_current_stage text;
  v_stages text[] := array['created','contacted','rdv','quote_sent','paid','production','delivered','done'];
  v_current_idx int;
  v_new_idx int;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select seller_user_id, stage into v_seller_id, v_current_stage
    from public.prospects where id = p_prospect_id;
  if v_seller_id is null then raise exception 'Prospect introuvable'; end if;

  v_is_admin := is_current_user_admin();
  if v_seller_id != auth.uid() and not v_is_admin then
    raise exception 'Accès refusé';
  end if;

  v_current_idx := array_position(v_stages, v_current_stage);
  v_new_idx := array_position(v_stages, p_new_stage);
  if v_new_idx is null then raise exception 'Étape inconnue: %', p_new_stage; end if;

  if abs(v_new_idx - v_current_idx) > 1 and (p_justification is null or length(trim(p_justification)) = 0) then
    raise exception 'Justification requise pour sauter de "%" à "%"', v_current_stage, p_new_stage;
  end if;

  if p_new_stage = 'paid' then
    raise exception 'L''étape "Payé" ne peut pas être déclarée manuellement — elle est automatique dès confirmation Stripe.';
  end if;

  if p_new_stage in ('production','delivered','done') and not v_is_admin then
    raise exception 'L''étape "%" est pilotée par le studio, pas par le vendeur — utilise "Envoyer au studio" une fois la commande payée.', p_new_stage;
  end if;

  update public.prospects set stage = p_new_stage where id = p_prospect_id;
  insert into public.prospect_stage_history (prospect_id, seller_user_id, from_stage, to_stage, justification)
  values (p_prospect_id, v_seller_id, v_current_stage, p_new_stage, p_justification);
end;
$$;
revoke all on function public.advance_prospect_stage(uuid, text, text) from public;
revoke all on function public.advance_prospect_stage(uuid, text, text) from anon;
grant execute on function public.advance_prospect_stage(uuid, text, text) to authenticated;

-- orders.status (migration 0006) n'autorisait pas 'done' du tout : sans ce
-- fix, le premier appel réel à admin_set_order_status(..., 'done') ci-dessous
-- aurait planté avec "violates check constraint orders_status_check"
-- (trouvé en testant réellement l'appel, pas en relisant le SQL).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('draft','awaiting_payment','paid','production','delivered','done','cancelled','refunded'));

-- admin_set_order_status() (migration 0006) ne gérait que production/delivered ;
-- ajoute 'done' (terminé), la clôture finale décidée par le studio/admin.
create or replace function public.admin_set_order_status(p_order_id uuid, p_new_status text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_new_status not in ('production','delivered','done') then
    raise exception 'admin_set_order_status ne gère que production/delivered/done — les autres statuts sont automatiques (Stripe) ou définis à la création';
  end if;
  update public.orders set status = p_new_status, updated_at = now() where id = p_order_id;
  if p_new_status in ('delivered','done') then
    update public.prospects set stage = p_new_status where id = (select prospect_id from public.orders where id = p_order_id);
  end if;
end;
$$;
revoke all on function public.admin_set_order_status(uuid, text) from public;
revoke all on function public.admin_set_order_status(uuid, text) from anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
