create schema if not exists test;
grant usage on schema test to public;

create or replace function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

create or replace function test.eq(a anyelement, b anyelement, msg text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED: % (got %, expected %)', msg, a, b; end if; end $$;

-- Exécute `sql` avec le rôle courant et exige une erreur contenant `expected`.
create or replace function test.throws(sql text, expected text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm like '%' || expected || '%' then return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %, expected %)', msg, sqlerrm, expected;
  end;
  raise exception 'ASSERT FAILED: % (no error raised, expected %)', msg, expected;
end $$;

create or replace function test.mkuser(p_email text, p_meta jsonb default '{}') returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v, p_email, p_meta);
  return v;
end $$;

create or replace function test.login(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

create or replace function test.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
end $$;

create or replace function test.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;

create or replace function test.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Invariant comptable : solde = somme des mouvements, réservé = holds ouverts.
create or replace function test.check_ledger_invariants() returns void language plpgsql as $$
declare r record;
begin
  for r in
    select w.id, w.balance_cents, w.held_cents,
      coalesce((select sum(case when t.type in ('topup','bonus','commercial_credit','promotion','refund','manual_adjustment') then t.amount_cents
                                 when t.type in ('purchase','capture') then -t.amount_cents else 0 end)
                from public.wallet_transactions t where t.wallet_id = w.id), 0) as expected_balance,
      coalesce((select sum(case when t.type = 'hold' then t.amount_cents when t.type in ('release','capture') then -t.amount_cents else 0 end)
                from public.wallet_transactions t where t.wallet_id = w.id), 0) as expected_held,
      coalesce((select sum(h.amount_cents) from public.wallet_holds h where h.wallet_id = w.id and h.status = 'held'), 0) as open_holds
    from public.wallets w
  loop
    if r.balance_cents <> r.expected_balance then raise exception 'LEDGER MISMATCH balance wallet % (% vs %)', r.id, r.balance_cents, r.expected_balance; end if;
    if r.held_cents <> r.expected_held then raise exception 'LEDGER MISMATCH held wallet % (% vs %)', r.id, r.held_cents, r.expected_held; end if;
    if r.held_cents <> r.open_holds then raise exception 'HOLD MISMATCH wallet % (% vs %)', r.id, r.held_cents, r.open_holds; end if;
  end loop;
end $$;
