-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — Conformité, contrats & signature électronique
-- ══════════════════════════════════════════════════════════════════════════
-- Remplace l'envoi de contrats par email : signature électronique intégrée,
-- dossier administratif (identité, statut pro, pièces justificatives,
-- coordonnées bancaires) et validation admin, pour les Vendeurs (index.html)
-- ET les Ambassadeurs (ambassadors.html) — même moteur, "role" distingue les
-- deux (contrats et grilles de rémunération différents, mais même mécanique
-- de conformité).
--
-- Principe repris du reste du schéma : rien n'est "vrai" tant qu'une preuve
-- ne l'établit pas. Les signatures, dépôts de documents et modifications de
-- RIB sont append-only (jamais réécrits), la conformité du dossier est
-- CALCULÉE EN DIRECT (get_my_compliance_status / admin_get_compliance_dossier)
-- à partir de ces preuves, jamais un statut qu'on pourrait faire mentir en le
-- mettant à jour à la main.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. COMPLIANCE_PROFILES — identité + informations professionnelles
--    déclaratives (un vendeur ET ambassadeur potentiel = 2 lignes distinctes)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.compliance_profiles (
  user_id            uuid not null references auth.users(id) on delete cascade,
  role               text not null check (role in ('vendeur','ambassadeur')),
  first_name         text,
  last_name          text,
  birth_date         date,
  birth_place        text,
  address            text,
  phone              text,
  nationality        text,
  legal_status       text,   -- "statut juridique" (micro-entreprise, EI, EURL...)
  siret              text,
  vat_number         text,
  company_name       text,
  company_created_at date,
  updated_at         timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.compliance_profiles enable row level security;
drop policy if exists compliance_profiles_select on public.compliance_profiles;
create policy compliance_profiles_select on public.compliance_profiles for select
  using (auth.uid() = user_id or is_current_user_admin());
-- Aucune policy insert/update directe : passe par set_my_compliance_profile()
-- (borne les colonnes modifiables, journalise dans compliance_audit_log).


-- ──────────────────────────────────────────────────────────────────────────
-- 2. CONTRACT_SIGNATURES — append-only. Une re-signature (nouvelle version
--    de contrat) crée une NOUVELLE ligne, jamais une réécriture — l'historique
--    juridique complet doit rester consultable tel quel.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.contract_signatures (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null check (role in ('vendeur','ambassadeur')),
  contract_version  text not null,   -- ex: 'vendeur-v1.0'
  signed_at         timestamptz not null default now(),
  ip_address        inet,
  user_agent        text,
  -- Empreinte SHA-256 (hex) de l'image de signature réellement capturée —
  -- preuve d'intégrité indépendante du fichier lui-même : toute altération,
  -- même minime, du PNG archivé changerait ce hash. Calculée côté serveur
  -- à partir des octets reçus, jamais fournie par le client.
  signature_hash    text,
  -- Snapshot des informations utilisées pour remplir le contrat au moment de
  -- la signature — figé même si le profil est modifié ensuite (le PDF signé
  -- doit toujours correspondre à ce qui a réellement été signé).
  filled_fields     jsonb not null default '{}'::jsonb,
  signature_image_path text not null,  -- chemin Storage (bucket "compliance")
  contract_pdf_path    text not null,  -- chemin Storage du PDF signé généré
  admin_status      text not null default 'pending' check (admin_status in ('pending','validated','refused')),
  admin_reviewed_by uuid references auth.users(id),
  admin_reviewed_at timestamptz,
  admin_notes       text,
  unique (user_id, role, contract_version)
);

create index if not exists contract_signatures_user_idx on public.contract_signatures (user_id, role);
create index if not exists contract_signatures_admin_status_idx on public.contract_signatures (admin_status);

alter table public.contract_signatures enable row level security;
drop policy if exists contract_signatures_select on public.contract_signatures;
create policy contract_signatures_select on public.contract_signatures for select
  using (auth.uid() = user_id or is_current_user_admin());
-- Écriture exclusivement via compliance-sign-contract.js (service_role, après
-- génération réelle du PDF) — jamais de policy insert pour authenticated : un
-- contrat "signé" sans PDF/signature réellement générés n'a aucune valeur.

create or replace function public.block_mutation_signed_contract()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'contract_signatures: suppression interdite (id=%)', OLD.id;
  end if;
  -- Seules les colonnes de revue admin peuvent changer après création.
  if OLD.signed_at is distinct from NEW.signed_at
     or OLD.ip_address is distinct from NEW.ip_address
     or OLD.signature_hash is distinct from NEW.signature_hash
     or OLD.filled_fields is distinct from NEW.filled_fields
     or OLD.signature_image_path is distinct from NEW.signature_image_path
     or OLD.contract_pdf_path is distinct from NEW.contract_pdf_path
     or OLD.contract_version is distinct from NEW.contract_version then
    raise exception 'contract_signatures: preuve de signature immuable (id=%)', OLD.id;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_contract_signatures_no_delete on public.contract_signatures;
create trigger trg_contract_signatures_no_delete before delete on public.contract_signatures
  for each row execute function block_mutation_signed_contract();
drop trigger if exists trg_contract_signatures_guard on public.contract_signatures;
create trigger trg_contract_signatures_guard before update on public.contract_signatures
  for each row execute function block_mutation_signed_contract();


-- ──────────────────────────────────────────────────────────────────────────
-- 3. COMPLIANCE_DOCUMENTS — pièces justificatives déposées (identité, RIB
--    scanné, justificatif SIRET, attestation URSSAF, certificat TVA...)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.compliance_documents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null check (role in ('vendeur','ambassadeur')),
  doc_type          text not null check (doc_type in ('identity','rib','siret_proof','urssaf','vat_cert','other')),
  storage_path      text not null,
  file_name         text not null,
  uploaded_at       timestamptz not null default now(),
  expires_at        date,
  admin_status      text not null default 'pending' check (admin_status in ('pending','validated','refused')),
  admin_reviewed_by uuid references auth.users(id),
  admin_reviewed_at timestamptz,
  admin_notes       text
);

create index if not exists compliance_documents_user_idx on public.compliance_documents (user_id, role);
create index if not exists compliance_documents_expiry_idx on public.compliance_documents (expires_at) where expires_at is not null;

alter table public.compliance_documents enable row level security;
drop policy if exists compliance_documents_select on public.compliance_documents;
create policy compliance_documents_select on public.compliance_documents for select
  using (auth.uid() = user_id or is_current_user_admin());
-- Écriture via compliance-documents.js (service_role) uniquement — valide le
-- type/la taille avant insertion, ce qu'une simple policy ne peut pas faire.


-- ──────────────────────────────────────────────────────────────────────────
-- 4. PAYMENT_INFO — RIB/IBAN/BIC. Append-only comme contract_signatures :
--    "chaque modification doit créer une notification administrateur" et
--    doit rester dans l'historique — une simple UPDATE effacerait la preuve
--    de ce qu'était le RIB avant modification.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_info (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null check (role in ('vendeur','ambassadeur')),
  iban              text not null,
  bic               text not null,
  bank_name         text,
  account_holder    text not null,
  created_at        timestamptz not null default now(),
  admin_status      text not null default 'pending' check (admin_status in ('pending','validated','refused')),
  admin_reviewed_by uuid references auth.users(id),
  admin_reviewed_at timestamptz,
  admin_notes       text
);

create index if not exists payment_info_user_idx on public.payment_info (user_id, role, created_at desc);

alter table public.payment_info enable row level security;
drop policy if exists payment_info_select on public.payment_info;
create policy payment_info_select on public.payment_info for select
  using (auth.uid() = user_id or is_current_user_admin());
-- Écriture via compliance-payment-info.js (service_role) uniquement.


-- ──────────────────────────────────────────────────────────────────────────
-- 5. COMPLIANCE_AUDIT_LOG — append-only, une ligne par évènement important
--    (création, signature, modif RIB, ajout document, validation, refus,
--    changement de statut) — même principe que "audit_logs" (0003).
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.compliance_audit_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('vendeur','ambassadeur')),
  actor      text not null default 'system',  -- 'user:<id>' | 'admin:<email>' | 'system'
  action     text not null,
  details    jsonb not null default '{}'::jsonb
);

create index if not exists compliance_audit_log_user_idx on public.compliance_audit_log (user_id, role, created_at desc);

alter table public.compliance_audit_log enable row level security;
drop policy if exists compliance_audit_log_select on public.compliance_audit_log;
create policy compliance_audit_log_select on public.compliance_audit_log for select
  using (auth.uid() = user_id or is_current_user_admin());

create or replace function public.block_delete_audit()
returns trigger language plpgsql as $$
begin
  raise exception 'compliance_audit_log est append-only : % interdit (id=%)', TG_OP, OLD.id;
end; $$;
drop trigger if exists trg_compliance_audit_no_delete on public.compliance_audit_log;
create trigger trg_compliance_audit_no_delete before delete on public.compliance_audit_log
  for each row execute function block_delete_audit();
drop trigger if exists trg_compliance_audit_no_update on public.compliance_audit_log;
create trigger trg_compliance_audit_no_update before update on public.compliance_audit_log
  for each row execute function block_delete_audit();


-- ──────────────────────────────────────────────────────────────────────────
-- 6. LECTURE — dossier complet + score de conformité, calculés en direct.
--    Checklist (5 items, 20% chacun) : contrat signé, identité déposée, RIB
--    validé (par un admin), SIRET renseigné, justificatif SIRET déposé.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_compliance_dossier(p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
stable
as $$
declare
  v_profile record;
  v_latest_signature record;
  v_latest_payment record;
  v_has_identity boolean;
  v_has_siret_proof boolean;
  v_score integer := 0;
  v_status text := 'incomplete';
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_role not in ('vendeur','ambassadeur') then raise exception 'Rôle invalide'; end if;

  select * into v_profile from public.compliance_profiles where user_id = auth.uid() and role = p_role;

  select * into v_latest_signature from public.contract_signatures
    where user_id = auth.uid() and role = p_role order by signed_at desc limit 1;

  select * into v_latest_payment from public.payment_info
    where user_id = auth.uid() and role = p_role order by created_at desc limit 1;

  v_has_identity := exists(select 1 from public.compliance_documents where user_id = auth.uid() and role = p_role and doc_type = 'identity');
  v_has_siret_proof := exists(select 1 from public.compliance_documents where user_id = auth.uid() and role = p_role and doc_type = 'siret_proof');

  if v_latest_signature.id is not null then v_score := v_score + 20; end if;
  if v_has_identity then v_score := v_score + 20; end if;
  if v_latest_payment.admin_status = 'validated' then v_score := v_score + 20; end if;
  if v_profile.siret is not null and length(trim(v_profile.siret)) > 0 then v_score := v_score + 20; end if;
  if v_has_siret_proof then v_score := v_score + 20; end if;

  if v_score = 100 then v_status := 'conforme'; end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'latest_signature', to_jsonb(v_latest_signature),
    'latest_payment_info', to_jsonb(v_latest_payment),
    'has_identity_doc', v_has_identity,
    'has_siret_proof', v_has_siret_proof,
    'score', v_score,
    'status', v_status
  );
end;
$$;
revoke all on function public.get_my_compliance_dossier(text) from public;
revoke all on function public.get_my_compliance_dossier(text) from anon;
grant execute on function public.get_my_compliance_dossier(text) to authenticated;

-- Même calcul que ci-dessus mais pour n'importe quel utilisateur — réservé
-- admin. Utilisé par le back-office ("Contrats à valider" / dossier détaillé).
create or replace function public.admin_get_compliance_dossier(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
stable
as $$
declare
  v_profile record;
  v_latest_signature record;
  v_latest_payment record;
  v_has_identity boolean;
  v_has_siret_proof boolean;
  v_score integer := 0;
  v_status text := 'incomplete';
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_role not in ('vendeur','ambassadeur') then raise exception 'Rôle invalide'; end if;

  select * into v_profile from public.compliance_profiles where user_id = p_user_id and role = p_role;
  select * into v_latest_signature from public.contract_signatures
    where user_id = p_user_id and role = p_role order by signed_at desc limit 1;
  select * into v_latest_payment from public.payment_info
    where user_id = p_user_id and role = p_role order by created_at desc limit 1;
  v_has_identity := exists(select 1 from public.compliance_documents where user_id = p_user_id and role = p_role and doc_type = 'identity');
  v_has_siret_proof := exists(select 1 from public.compliance_documents where user_id = p_user_id and role = p_role and doc_type = 'siret_proof');

  if v_latest_signature.id is not null then v_score := v_score + 20; end if;
  if v_has_identity then v_score := v_score + 20; end if;
  if v_latest_payment.admin_status = 'validated' then v_score := v_score + 20; end if;
  if v_profile.siret is not null and length(trim(v_profile.siret)) > 0 then v_score := v_score + 20; end if;
  if v_has_siret_proof then v_score := v_score + 20; end if;
  if v_score = 100 then v_status := 'conforme'; end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'latest_signature', to_jsonb(v_latest_signature),
    'latest_payment_info', to_jsonb(v_latest_payment),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.compliance_documents d where d.user_id = p_user_id and d.role = p_role),
    'signatures', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.contract_signatures s where s.user_id = p_user_id and s.role = p_role order by s.signed_at desc),
    'payment_history', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.payment_info p where p.user_id = p_user_id and p.role = p_role order by p.created_at desc),
    'audit_log', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.compliance_audit_log a where a.user_id = p_user_id and a.role = p_role order by a.created_at desc),
    'has_identity_doc', v_has_identity,
    'has_siret_proof', v_has_siret_proof,
    'score', v_score,
    'status', v_status
  );
end;
$$;
revoke all on function public.admin_get_compliance_dossier(uuid, text) from public;
revoke all on function public.admin_get_compliance_dossier(uuid, text) from anon;
grant execute on function public.admin_get_compliance_dossier(uuid, text) to authenticated;

-- Liste pour le back-office "Contrats à valider" : un vendeur/ambassadeur =
-- une ligne, avec le nécessaire pour l'écran de liste sans faire N requêtes.
create or replace function public.admin_list_compliance_dossiers()
returns table(
  user_id uuid, email text, role text,
  first_name text, last_name text, phone text,
  contract_signed_at timestamptz, contract_status text, contract_version text,
  payment_status text, score integer, dossier_status text
)
language plpgsql
security definer
set search_path to 'public'
stable
as $$
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;

  return query
    select
      p.user_id, u.email, p.role, p.first_name, p.last_name, p.phone,
      s.signed_at, s.admin_status, s.contract_version,
      pay.admin_status,
      (
        (case when s.id is not null then 20 else 0 end) +
        (case when exists(select 1 from public.compliance_documents cd where cd.user_id = p.user_id and cd.role = p.role and cd.doc_type = 'identity') then 20 else 0 end) +
        (case when pay.admin_status = 'validated' then 20 else 0 end) +
        (case when p.siret is not null and length(trim(p.siret)) > 0 then 20 else 0 end) +
        (case when exists(select 1 from public.compliance_documents cd2 where cd2.user_id = p.user_id and cd2.role = p.role and cd2.doc_type = 'siret_proof') then 20 else 0 end)
      )::integer as score,
      case when (
        (case when s.id is not null then 20 else 0 end) +
        (case when exists(select 1 from public.compliance_documents cd3 where cd3.user_id = p.user_id and cd3.role = p.role and cd3.doc_type = 'identity') then 20 else 0 end) +
        (case when pay.admin_status = 'validated' then 20 else 0 end) +
        (case when p.siret is not null and length(trim(p.siret)) > 0 then 20 else 0 end) +
        (case when exists(select 1 from public.compliance_documents cd4 where cd4.user_id = p.user_id and cd4.role = p.role and cd4.doc_type = 'siret_proof') then 20 else 0 end)
      ) = 100 then 'conforme' else 'incomplete' end as dossier_status
    from public.compliance_profiles p
    join auth.users u on u.id = p.user_id
    left join lateral (
      select cs.* from public.contract_signatures cs
      where cs.user_id = p.user_id and cs.role = p.role order by cs.signed_at desc limit 1
    ) s on true
    left join lateral (
      select pi.* from public.payment_info pi
      where pi.user_id = p.user_id and pi.role = p.role order by pi.created_at desc limit 1
    ) pay on true
    order by coalesce(s.signed_at, p.updated_at) desc;
end;
$$;
revoke all on function public.admin_list_compliance_dossiers() from public;
revoke all on function public.admin_list_compliance_dossiers() from anon;
grant execute on function public.admin_list_compliance_dossiers() to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 7. ÉCRITURE utilisateur — profil personnel/pro (jamais la signature ni les
--    documents : ceux-ci passent par des Netlify Functions service_role qui
--    génèrent réellement le PDF / valident le fichier avant insertion).
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.set_my_compliance_profile(
  p_role text, p_first_name text, p_last_name text, p_birth_date date, p_birth_place text,
  p_address text, p_phone text, p_nationality text, p_legal_status text, p_siret text,
  p_vat_number text, p_company_name text, p_company_created_at date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_role not in ('vendeur','ambassadeur') then raise exception 'Rôle invalide'; end if;

  insert into public.compliance_profiles (
    user_id, role, first_name, last_name, birth_date, birth_place, address, phone,
    nationality, legal_status, siret, vat_number, company_name, company_created_at, updated_at
  ) values (
    auth.uid(), p_role, p_first_name, p_last_name, p_birth_date, p_birth_place, p_address, p_phone,
    p_nationality, p_legal_status, p_siret, p_vat_number, p_company_name, p_company_created_at, now()
  )
  on conflict (user_id, role) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    birth_date = excluded.birth_date, birth_place = excluded.birth_place,
    address = excluded.address, phone = excluded.phone, nationality = excluded.nationality,
    legal_status = excluded.legal_status, siret = excluded.siret, vat_number = excluded.vat_number,
    company_name = excluded.company_name, company_created_at = excluded.company_created_at,
    updated_at = now();

  insert into public.compliance_audit_log (user_id, role, actor, action, details)
  values (auth.uid(), p_role, 'user:' || auth.uid()::text, 'profile_updated', '{}'::jsonb);
end;
$$;
revoke all on function public.set_my_compliance_profile(text, text, text, date, text, text, text, text, text, text, text, text, date) from public;
revoke all on function public.set_my_compliance_profile(text, text, text, date, text, text, text, text, text, text, text, text, date) from anon;
grant execute on function public.set_my_compliance_profile(text, text, text, date, text, text, text, text, text, text, text, text, date) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 8. VALIDATION ADMIN — contrat / document / RIB. Chaque fonction journalise
--    dans compliance_audit_log (jamais une UPDATE silencieuse).
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_contract_status(p_signature_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin_email text; v_user_id uuid; v_role text;
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_status not in ('validated','refused','pending') then raise exception 'Statut invalide'; end if;
  v_admin_email := auth.jwt()->>'email';

  select user_id, role into v_user_id, v_role from public.contract_signatures where id = p_signature_id;
  if v_user_id is null then raise exception 'Signature introuvable'; end if;

  update public.contract_signatures
    set admin_status = p_status, admin_reviewed_by = auth.uid(), admin_reviewed_at = now(), admin_notes = p_notes
    where id = p_signature_id;

  insert into public.compliance_audit_log (user_id, role, actor, action, details)
  values (v_user_id, v_role, 'admin:' || v_admin_email, 'contract_' || p_status, jsonb_build_object('signature_id', p_signature_id, 'notes', p_notes));
end;
$$;
revoke all on function public.admin_set_contract_status(uuid, text, text) from public;
revoke all on function public.admin_set_contract_status(uuid, text, text) from anon;
grant execute on function public.admin_set_contract_status(uuid, text, text) to authenticated;

create or replace function public.admin_set_document_status(p_document_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin_email text; v_user_id uuid; v_role text; v_doc_type text;
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_status not in ('validated','refused','pending') then raise exception 'Statut invalide'; end if;
  v_admin_email := auth.jwt()->>'email';

  select user_id, role, doc_type into v_user_id, v_role, v_doc_type from public.compliance_documents where id = p_document_id;
  if v_user_id is null then raise exception 'Document introuvable'; end if;

  update public.compliance_documents
    set admin_status = p_status, admin_reviewed_by = auth.uid(), admin_reviewed_at = now(), admin_notes = p_notes
    where id = p_document_id;

  insert into public.compliance_audit_log (user_id, role, actor, action, details)
  values (v_user_id, v_role, 'admin:' || v_admin_email, 'document_' || p_status, jsonb_build_object('document_id', p_document_id, 'doc_type', v_doc_type, 'notes', p_notes));
end;
$$;
revoke all on function public.admin_set_document_status(uuid, text, text) from public;
revoke all on function public.admin_set_document_status(uuid, text, text) from anon;
grant execute on function public.admin_set_document_status(uuid, text, text) to authenticated;

create or replace function public.admin_set_payment_info_status(p_payment_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin_email text; v_user_id uuid; v_role text;
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_status not in ('validated','refused','pending') then raise exception 'Statut invalide'; end if;
  v_admin_email := auth.jwt()->>'email';

  select user_id, role into v_user_id, v_role from public.payment_info where id = p_payment_id;
  if v_user_id is null then raise exception 'RIB introuvable'; end if;

  update public.payment_info
    set admin_status = p_status, admin_reviewed_by = auth.uid(), admin_reviewed_at = now(), admin_notes = p_notes
    where id = p_payment_id;

  insert into public.compliance_audit_log (user_id, role, actor, action, details)
  values (v_user_id, v_role, 'admin:' || v_admin_email, 'payment_info_' || p_status, jsonb_build_object('payment_id', p_payment_id, 'notes', p_notes));
end;
$$;
revoke all on function public.admin_set_payment_info_status(uuid, text, text) from public;
revoke all on function public.admin_set_payment_info_status(uuid, text, text) from anon;
grant execute on function public.admin_set_payment_info_status(uuid, text, text) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 9. VERROU COMMISSIONS — "le vendeur peut alors recevoir ses commissions"
--    implique la réciproque : PAS de retrait tant que le dossier vendeur
--    n'est pas conforme.
--
-- CHOIX DE CONCEPTION (révisé) : plutôt que de redéfinir request_payout()
-- (0006) — ce qui obligerait à recopier intégralement sa logique financière
-- et ferait courir un risque de régression si cette logique change plus
-- tard sans que quelqu'un pense à répercuter la copie ici — le verrou est
-- posé comme un trigger BEFORE INSERT sur "payouts" lui-même :
--   - Aucune ligne de request_payout() n'est touchée : la fonction reste
--     EXACTEMENT celle de la migration 0006, telle quelle.
--   - Le verrou s'applique à TOUTE insertion dans "payouts", quel que soit
--     le chemin de code qui la déclenche (défense en profondeur : même un
--     futur second point d'entrée pour les retraits serait automatiquement
--     couvert, sans y penser explicitement).
--   - Zéro risque de divergence entre "la copie ici" et "l'original" : il
--     n'y a plus de copie.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_seller_compliance_conforme(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public' stable
as $$
declare v_profile record; v_latest_payment_status text; v_score integer := 0;
begin
  select * into v_profile from public.compliance_profiles where user_id = p_user_id and role = 'vendeur';
  if v_profile.user_id is null then return false; end if;

  select admin_status into v_latest_payment_status
    from public.payment_info where user_id = p_user_id and role = 'vendeur'
    order by created_at desc limit 1;

  if exists(select 1 from public.contract_signatures where user_id = p_user_id and role = 'vendeur') then v_score := v_score + 20; end if;
  if exists(select 1 from public.compliance_documents where user_id = p_user_id and role = 'vendeur' and doc_type = 'identity') then v_score := v_score + 20; end if;
  if v_latest_payment_status = 'validated' then v_score := v_score + 20; end if;
  if v_profile.siret is not null and length(trim(v_profile.siret)) > 0 then v_score := v_score + 20; end if;
  if exists(select 1 from public.compliance_documents where user_id = p_user_id and role = 'vendeur' and doc_type = 'siret_proof') then v_score := v_score + 20; end if;

  return v_score = 100;
end;
$$;
revoke all on function public.is_seller_compliance_conforme(uuid) from public;
revoke all on function public.is_seller_compliance_conforme(uuid) from anon;
comment on function public.is_seller_compliance_conforme(uuid) is
  'Score de conformité du dossier vendeur (contrat + identité + RIB validé + SIRET + justificatif SIRET), utilisée par le trigger trg_payouts_require_compliance sur public.payouts.';

create or replace function public.enforce_seller_compliance_before_payout()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_seller_compliance_conforme(NEW.seller_user_id) then
    raise exception 'Dossier administratif incomplet : signe ton contrat et complète ton dossier (identité, RIB validé, SIRET) avant de pouvoir retirer tes commissions.';
  end if;
  return NEW;
end;
$$;
comment on function public.enforce_seller_compliance_before_payout() is
  'Trigger BEFORE INSERT sur public.payouts — bloque toute création de retrait pour un vendeur dont le dossier administratif n''est pas conforme à 100%, quel que soit le code appelant.';

drop trigger if exists trg_payouts_require_compliance on public.payouts;
create trigger trg_payouts_require_compliance
  before insert on public.payouts
  for each row execute function public.enforce_seller_compliance_before_payout();


-- ──────────────────────────────────────────────────────────────────────────
-- 10. STORAGE — bucket privé pour les PDF signés, images de signature et
--     pièces justificatives. Convention de chemin : "{role}/{user_id}/...".
--     Écriture exclusivement service_role (Netlify Functions génèrent le
--     contenu — un fichier "déposé" sans passer par la validation applicative
--     n'a aucune valeur) ; lecture directe possible pour le propriétaire et
--     l'admin, en plus des URLs signées à durée limitée déjà utilisées côté
--     Netlify Functions pour l'affichage/téléchargement.
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('compliance-documents', 'compliance-documents', false, 10485760)
on conflict (id) do nothing;

drop policy if exists compliance_storage_select_own on storage.objects;
create policy compliance_storage_select_own on storage.objects for select
  using (
    bucket_id = 'compliance-documents'
    and (
      is_current_user_admin()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );
-- Aucune policy insert/update/delete pour anon/authenticated : uniquement
-- service_role (Netlify Functions), qui a déjà vérifié l'identité de
-- l'appelant et le contenu du fichier avant de l'écrire.


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution :
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--   and tablename in ('compliance_profiles','contract_signatures',
--   'compliance_documents','payment_info','compliance_audit_log');
-- ──────────────────────────────────────────────────────────────────────────
