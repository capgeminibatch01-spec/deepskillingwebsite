-- =====================================================================
--  Deep Skilling Training — Supabase schema
--  Run this ONCE in the Supabase SQL Editor of a fresh project.
--  It is idempotent enough to re-run safely during setup.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
--  1. ADMIN USERS  (authorization layer on top of Supabase Auth)
-- =====================================================================
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin can read own admin row" on public.admin_users;
create policy "admin can read own admin row"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

-- Helper used by every policy / function that needs authorization.
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users a where a.user_id = p_uid);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;


-- =====================================================================
--  2. MAINTENANCE STATE  (server-side lock — blocks registration during
--     delete + reindex, and blocks concurrent admin deletions)
-- =====================================================================
create table if not exists public.maintenance_state (
  id         boolean primary key default true,
  is_locked  boolean not null default false,
  reason     text,
  locked_at  timestamptz,
  locked_by  uuid,
  constraint maintenance_state_singleton check (id)
);

insert into public.maintenance_state (id, is_locked)
values (true, false)
on conflict (id) do nothing;

alter table public.maintenance_state enable row level security;
-- No policies: nothing may touch this table directly. Access is via
-- the SECURITY DEFINER functions below only.


-- =====================================================================
--  3. REGISTRATIONS
-- =====================================================================
create table if not exists public.registrations (
  id                          uuid primary key default gen_random_uuid(),
  serial_no                   integer not null,
  mafoi_id                    text    not null,

  -- Mobilization -----------------------------------------------------
  unique_id_type              text not null,
  id_proof                    text not null,
  first_name                  text not null,
  last_name                   text not null,
  date_of_birth               date not null,
  gender                      text not null,
  beneficiary_state           text not null,
  district                    text not null,
  contact_number              text not null,
  email                       text not null,
  ews_category                text not null,

  -- Enrolment --------------------------------------------------------
  last_completed_education    text not null,
  degree_specialization       text not null,
  education_document_path     text not null,
  education_document_name     text not null,
  annual_income               text not null,
  occupation                  text not null,
  institution_type            text null,
  ews_certificate_path        text not null,
  ews_certificate_name        text not null,
  domain_course               text not null,
  pwd_status                  text not null,
  pwd_certificate_path        text null,
  pwd_certificate_name        text null,
  parent_name                 text not null,
  alternative_contact_number  text not null,
  social_category             text not null,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- ---- Value domains (server-side truth for every dropdown) --------
  constraint reg_unique_id_type_chk check (unique_id_type in (
    'PAN Card','Electoral Card','Driving License','College ID','School 10th / 12th Marksheet')),
  constraint reg_gender_chk check (gender in (
    'Male','Female','Third Gender','Prefer Not to Say')),
  constraint reg_state_chk check (beneficiary_state in ('TamilNadu','Andhra Pradesh')),
  constraint reg_ews_chk check (ews_category in ('Yes - 1','No - 2')),
  constraint reg_education_chk check (last_completed_education in (
    '1-Not completed formal education','2-Completed 12th','3-Diploma/ITI',
    '4-Graduation','5-Post Graduation & above','6-None of the above')),
  constraint reg_degree_chk check (degree_specialization in (
    'B.A.','B.Sc.','B.Com.','B.Tech/B.E.','BCA','M.A.','M.Sc.','MBA','M.Tech','Diploma','ITI')),
  constraint reg_income_chk check (annual_income in (
    '1-Less than 99,999','2-1 to 2.99 Lakh','3-3 to 4.99 Lakh','4-5 to 7.99 Lakh','5-Above 8 Lakh')),
  constraint reg_occupation_chk check (occupation in (
    '1-Employed','2-Unemployed','3-Entrepreneur','4-Student','5-Unpaid work')),
  constraint reg_institution_chk check (institution_type is null or institution_type in (
    '1-School','2-University','3-ITI','4-NGO Centre','5-None')),
  constraint reg_domain_chk check (domain_course in (
    'Data Analytics','Artificial Intelligence','Cyber Security')),
  constraint reg_pwd_chk check (pwd_status in ('Yes - 1','No - 2')),
  constraint reg_social_chk check (social_category in (
    'SC-1','ST-2','OBC-3','Gen-4','Prefer not to say-5')),

  -- ---- Format rules -------------------------------------------------
  constraint reg_id_proof_chk    check (id_proof ~ '^[0-9]+$'),
  constraint reg_contact_chk     check (contact_number ~ '^[0-9]{10}$'),
  constraint reg_alt_contact_chk check (alternative_contact_number ~ '^[0-9]{10}$'),
  constraint reg_email_chk       check (email ~ '^[a-z0-9]+([._%+-][a-z0-9]+)*@gmail\.com$'),
  constraint reg_first_name_chk  check (btrim(first_name) <> ''),
  constraint reg_last_name_chk   check (btrim(last_name)  <> ''),
  constraint reg_parent_name_chk check (btrim(parent_name) <> ''),
  constraint reg_serial_chk      check (serial_no > 0),
  constraint reg_mafoi_chk       check (mafoi_id ~ '^DS[0-9]{3,}$'),

  -- ---- Cross-field relationships (§11, §15, §7.8) -------------------
  constraint reg_state_district_chk check (
    (beneficiary_state = 'TamilNadu'      and district = 'Chennai') or
    (beneficiary_state = 'Andhra Pradesh' and district in ('Vishak','Vijayawada'))
  ),
  constraint reg_occupation_institution_chk check (
    (occupation =  '4-Student' and institution_type is not null) or
    (occupation <> '4-Student' and institution_type is null)
  ),
  constraint reg_pwd_certificate_chk check (
    (pwd_status = 'Yes - 1' and pwd_certificate_path is not null and pwd_certificate_name is not null) or
    (pwd_status = 'No - 2'  and pwd_certificate_path is null     and pwd_certificate_name is null)
  ),

  -- ---- Duplicate prevention (§41) ------------------------------------
  constraint reg_identity_unique unique (unique_id_type, id_proof),
  constraint reg_email_unique    unique (email)
);

-- serial_no / mafoi_id uniqueness is DEFERRABLE so that a whole-table
-- renumber can happen inside one transaction without transient
-- unique-violation errors (§29).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reg_serial_no_unique') then
    alter table public.registrations
      add constraint reg_serial_no_unique unique (serial_no) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reg_mafoi_id_unique') then
    alter table public.registrations
      add constraint reg_mafoi_id_unique unique (mafoi_id) deferrable initially deferred;
  end if;
end $$;

create index if not exists registrations_serial_idx  on public.registrations (serial_no);
create index if not exists registrations_domain_idx  on public.registrations (domain_course);
create index if not exists registrations_created_idx on public.registrations (created_at);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists registrations_touch_updated_at on public.registrations;
create trigger registrations_touch_updated_at
  before update on public.registrations
  for each row execute function public.touch_updated_at();

-- ---- Row Level Security ------------------------------------------------
alter table public.registrations enable row level security;

-- Students (anon) get NO policy at all: they cannot select, insert,
-- update or delete. All writes happen through the Edge Function using
-- the service role. Admins get read-only access.
drop policy if exists "admins read registrations" on public.registrations;
create policy "admins read registrations"
  on public.registrations for select
  to authenticated
  using (public.is_admin(auth.uid()));


-- =====================================================================
--  4. NAMING HELPERS  (single source of truth for file names)
-- =====================================================================
create or replace function public.ds_id(p_serial integer)
returns text language sql immutable as $$
  select 'DS' || lpad(p_serial::text, 3, '0');
$$;

create or replace function public.sanitize_name_part(p_text text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
           regexp_replace(coalesce(p_text, ''), '[^A-Za-z0-9 ._-]', '', 'g'),
           '\s+', ' ', 'g'));
$$;

create or replace function public.file_extension(p_name text)
returns text language sql immutable as $$
  select lower(coalesce(substring(p_name from '\.([A-Za-z0-9]+)$'), 'pdf'));
$$;

-- {MafoiID}_{Kind}_{First Last}.{ext}
create or replace function public.document_filename(
  p_mafoi text, p_kind text, p_first text, p_last text, p_ext text)
returns text language sql immutable as $$
  select p_mafoi || '_' || p_kind || '_' ||
         btrim(public.sanitize_name_part(p_first) || ' ' || public.sanitize_name_part(p_last)) ||
         '.' || lower(p_ext);
$$;

create or replace function public.document_path(p_registration uuid, p_filename text)
returns text language sql immutable as $$
  select 'registrations/' || p_registration::text || '/' || p_filename;
$$;


-- =====================================================================
--  5. MAINTENANCE LOCK API
-- =====================================================================

-- Public / anon safe: lets the registration page show the banner.
create or replace function public.registration_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_locked', m.is_locked,
    'message', case when m.is_locked
                    then 'Updating registrations. Please wait...'
                    else 'Registration is available again.' end)
  from public.maintenance_state m where m.id;
$$;

revoke all on function public.registration_status() from public;
grant execute on function public.registration_status() to anon, authenticated, service_role;

-- Atomic compare-and-swap. Returns false when someone else holds the lock.
-- A lock older than 5 minutes is considered stale and may be taken over.
create or replace function public.acquire_maintenance_lock(p_reason text, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  update public.maintenance_state
     set is_locked = true,
         reason    = p_reason,
         locked_at = now(),
         locked_by = p_user
   where id
     and (is_locked = false or locked_at < now() - interval '5 minutes')
  returning true into v_ok;

  return coalesce(v_ok, false);
end $$;

create or replace function public.release_maintenance_lock()
returns void
language sql
security definer
set search_path = public
as $$
  update public.maintenance_state
     set is_locked = false, reason = null, locked_at = null, locked_by = null
   where id;
$$;

revoke all on function public.acquire_maintenance_lock(text, uuid) from public, anon, authenticated;
revoke all on function public.release_maintenance_lock()          from public, anon, authenticated;
grant execute on function public.acquire_maintenance_lock(text, uuid) to service_role;
grant execute on function public.release_maintenance_lock()          to service_role;


-- =====================================================================
--  6. CREATE REGISTRATION  (atomic serial + Ma Foi ID allocation)
--     Called only by the `register` Edge Function (service role).
--     The whole body is one transaction guarded by an advisory lock,
--     so simultaneous submissions can never share a serial_no. (§21,§22,§67)
-- =====================================================================
create or replace function public.create_registration(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key   bigint := 771001;      -- shared by registration + reindex
  v_locked     boolean;
  v_dob        date;
  v_serial     integer;
  v_mafoi      text;
  v_id         uuid := gen_random_uuid();
  v_first      text := btrim(coalesce(p->>'first_name', ''));
  v_last       text := btrim(coalesce(p->>'last_name', ''));
  v_occupation text := p->>'occupation';
  v_inst       text := nullif(btrim(coalesce(p->>'institution_type','')), '');
  v_pwd        text := p->>'pwd_status';
  v_edu_ext    text := public.file_extension(coalesce(p->>'education_ext','pdf'));
  v_ews_ext    text := public.file_extension(coalesce(p->>'ews_ext','pdf'));
  v_pwd_ext    text := public.file_extension(coalesce(p->>'pwd_ext','pdf'));
  v_edu_name   text;
  v_ews_name   text;
  v_pwd_name   text;
begin
  -- Serialise against reindexing and against other registrations.
  perform pg_advisory_xact_lock(v_lock_key);

  select is_locked into v_locked from public.maintenance_state where id;
  if v_locked then
    raise exception 'MAINTENANCE_LOCK' using errcode = 'P0001';
  end if;

  -- ---- Age: 18 <= age <= 36 on the real birth date (§7.5) -----------
  v_dob := (p->>'date_of_birth')::date;
  if v_dob is null then
    raise exception 'VALIDATION_ERROR|date_of_birth|Please enter your date of birth.' using errcode = 'P0001';
  end if;
  if v_dob > (current_date - interval '18 years')::date
     or v_dob <= (current_date - interval '37 years')::date then
    raise exception 'VALIDATION_ERROR|date_of_birth|Beneficiary must be between 18 and 36 years of age.'
      using errcode = 'P0001';
  end if;

  -- ---- Conditional-field integrity (belt and braces on the CHECKs) --
  if v_occupation = '4-Student' and v_inst is null then
    raise exception 'VALIDATION_ERROR|institution_type|Please select the type of institution.' using errcode = 'P0001';
  end if;
  if v_occupation <> '4-Student' and v_inst is not null then
    raise exception 'VALIDATION_ERROR|institution_type|Institution applies only when Occupation is 4-Student.' using errcode = 'P0001';
  end if;
  if v_pwd = 'Yes - 1' and coalesce(p->>'pwd_ext','') = '' then
    raise exception 'VALIDATION_ERROR|pwd_certificate|Please upload the PWD certificate.' using errcode = 'P0001';
  end if;
  if v_pwd = 'No - 2' and coalesce(p->>'pwd_ext','') <> '' then
    raise exception 'VALIDATION_ERROR|pwd_certificate|A PWD certificate must not be attached when PWD is "No - 2".' using errcode = 'P0001';
  end if;

  -- ---- Duplicate check (friendly error before hitting the constraint)
  if exists (select 1 from public.registrations r
              where r.unique_id_type = p->>'unique_id_type'
                and r.id_proof       = p->>'id_proof') then
    raise exception 'DUPLICATE_REGISTRATION' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.registrations r where r.email = p->>'email') then
    raise exception 'DUPLICATE_REGISTRATION' using errcode = 'P0001';
  end if;

  -- ---- Atomic sequential allocation ---------------------------------
  select coalesce(max(serial_no), 0) + 1 into v_serial from public.registrations;
  v_mafoi := public.ds_id(v_serial);

  v_edu_name := public.document_filename(v_mafoi, 'Educational Document', v_first, v_last, v_edu_ext);
  v_ews_name := public.document_filename(v_mafoi, 'EWS Certificate',      v_first, v_last, v_ews_ext);
  if v_pwd = 'Yes - 1' then
    v_pwd_name := public.document_filename(v_mafoi, 'PWD Certificate',    v_first, v_last, v_pwd_ext);
  end if;

  insert into public.registrations (
    id, serial_no, mafoi_id,
    unique_id_type, id_proof, first_name, last_name, date_of_birth, gender,
    beneficiary_state, district, contact_number, email, ews_category,
    last_completed_education, degree_specialization,
    education_document_path, education_document_name,
    annual_income, occupation, institution_type,
    ews_certificate_path, ews_certificate_name,
    domain_course, pwd_status, pwd_certificate_path, pwd_certificate_name,
    parent_name, alternative_contact_number, social_category
  ) values (
    v_id, v_serial, v_mafoi,
    p->>'unique_id_type', p->>'id_proof', v_first, v_last, v_dob, p->>'gender',
    p->>'beneficiary_state', p->>'district', p->>'contact_number', p->>'email', p->>'ews_category',
    p->>'last_completed_education', p->>'degree_specialization',
    public.document_path(v_id, v_edu_name), v_edu_name,
    p->>'annual_income', v_occupation, v_inst,
    public.document_path(v_id, v_ews_name), v_ews_name,
    p->>'domain_course', v_pwd,
    case when v_pwd = 'Yes - 1' then public.document_path(v_id, v_pwd_name) end, v_pwd_name,
    btrim(coalesce(p->>'parent_name','')), p->>'alternative_contact_number', p->>'social_category'
  );

  return jsonb_build_object(
    'id', v_id,
    'serial_no', v_serial,
    'mafoi_id', v_mafoi,
    'documents', jsonb_build_object(
      'education', jsonb_build_object('name', v_edu_name, 'path', public.document_path(v_id, v_edu_name)),
      'ews',       jsonb_build_object('name', v_ews_name, 'path', public.document_path(v_id, v_ews_name)),
      'pwd',       case when v_pwd_name is null then null
                        else jsonb_build_object('name', v_pwd_name, 'path', public.document_path(v_id, v_pwd_name)) end
    )
  );
exception
  when unique_violation then
    raise exception 'DUPLICATE_REGISTRATION' using errcode = 'P0001';
end $$;

revoke all on function public.create_registration(jsonb) from public, anon, authenticated;
grant execute on function public.create_registration(jsonb) to service_role;


-- =====================================================================
--  7. DELETE + REINDEX
--     Split into PLAN (read-only) and APPLY (transactional) so the
--     Edge Function can rename Storage objects between the two while
--     holding the maintenance lock. If a rename fails, APPLY is never
--     called and the database is untouched. (§25–§31)
-- =====================================================================
create or replace function public.compute_reindex_plan(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target   record;
  v_row      record;
  v_renames  jsonb := '[]'::jsonb;
  v_rows     jsonb := '[]'::jsonb;
  v_files    jsonb := '[]'::jsonb;
  v_new_name text;
  v_new_mafoi text;
begin
  select * into v_target from public.registrations where id = p_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_files := v_files || to_jsonb(v_target.education_document_path);
  v_files := v_files || to_jsonb(v_target.ews_certificate_path);
  if v_target.pwd_certificate_path is not null then
    v_files := v_files || to_jsonb(v_target.pwd_certificate_path);
  end if;

  for v_row in
    select r.*, row_number() over (order by r.serial_no)::int as new_serial
      from public.registrations r
     where r.id <> p_id
     order by r.serial_no
  loop
    continue when v_row.new_serial = v_row.serial_no;

    v_new_mafoi := public.ds_id(v_row.new_serial);

    -- education
    v_new_name := public.document_filename(v_new_mafoi, 'Educational Document',
                    v_row.first_name, v_row.last_name,
                    public.file_extension(v_row.education_document_name));
    v_renames := v_renames || jsonb_build_object(
      'from', v_row.education_document_path,
      'to',   public.document_path(v_row.id, v_new_name));

    -- ews
    v_new_name := public.document_filename(v_new_mafoi, 'EWS Certificate',
                    v_row.first_name, v_row.last_name,
                    public.file_extension(v_row.ews_certificate_name));
    v_renames := v_renames || jsonb_build_object(
      'from', v_row.ews_certificate_path,
      'to',   public.document_path(v_row.id, v_new_name));

    -- pwd (optional)
    if v_row.pwd_certificate_path is not null then
      v_new_name := public.document_filename(v_new_mafoi, 'PWD Certificate',
                      v_row.first_name, v_row.last_name,
                      public.file_extension(v_row.pwd_certificate_name));
      v_renames := v_renames || jsonb_build_object(
        'from', v_row.pwd_certificate_path,
        'to',   public.document_path(v_row.id, v_new_name));
    end if;

    v_rows := v_rows || jsonb_build_object(
      'id', v_row.id,
      'old_serial', v_row.serial_no,
      'new_serial', v_row.new_serial,
      'old_mafoi_id', v_row.mafoi_id,
      'new_mafoi_id', v_new_mafoi);
  end loop;

  return jsonb_build_object(
    'target', jsonb_build_object(
      'id', v_target.id,
      'mafoi_id', v_target.mafoi_id,
      'first_name', v_target.first_name,
      'last_name', v_target.last_name,
      'email', v_target.email,
      'files', v_files),
    'rows', v_rows,
    'renames', v_renames,
    'fingerprint', md5(v_rows::text)
  );
end $$;

-- Applies the plan. Re-derives the plan and refuses to run if the table
-- changed since PLAN was computed (fingerprint mismatch).
create or replace function public.apply_delete_reindex(p_id uuid, p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint := 771001;
  v_plan     jsonb;
  v_row      jsonb;
  v_offset   integer := 1000000;
  v_count    integer;
begin
  perform pg_advisory_xact_lock(v_lock_key);

  v_plan := public.compute_reindex_plan(p_id);

  if p_fingerprint is not null and (v_plan->>'fingerprint') <> p_fingerprint then
    raise exception 'PLAN_STALE' using errcode = 'P0001';
  end if;

  delete from public.registrations where id = p_id;

  -- Phase 1 — move every affected row far outside the live range so no
  -- intermediate state can collide (§29).
  for v_row in select * from jsonb_array_elements(v_plan->'rows') loop
    update public.registrations
       set serial_no = (v_row->>'new_serial')::int + v_offset,
           mafoi_id  = public.ds_id((v_row->>'new_serial')::int + v_offset)
     where id = (v_row->>'id')::uuid;
  end loop;

  -- Phase 2 — settle on the final values and rewrite document names/paths.
  for v_row in select * from jsonb_array_elements(v_plan->'rows') loop
    update public.registrations r
       set serial_no = (v_row->>'new_serial')::int,
           mafoi_id  = v_row->>'new_mafoi_id',
           education_document_name = public.document_filename(
             v_row->>'new_mafoi_id', 'Educational Document',
             r.first_name, r.last_name, public.file_extension(r.education_document_name)),
           education_document_path = public.document_path(r.id, public.document_filename(
             v_row->>'new_mafoi_id', 'Educational Document',
             r.first_name, r.last_name, public.file_extension(r.education_document_name))),
           ews_certificate_name = public.document_filename(
             v_row->>'new_mafoi_id', 'EWS Certificate',
             r.first_name, r.last_name, public.file_extension(r.ews_certificate_name)),
           ews_certificate_path = public.document_path(r.id, public.document_filename(
             v_row->>'new_mafoi_id', 'EWS Certificate',
             r.first_name, r.last_name, public.file_extension(r.ews_certificate_name))),
           pwd_certificate_name = case when r.pwd_certificate_name is null then null
             else public.document_filename(v_row->>'new_mafoi_id', 'PWD Certificate',
               r.first_name, r.last_name, public.file_extension(r.pwd_certificate_name)) end,
           pwd_certificate_path = case when r.pwd_certificate_path is null then null
             else public.document_path(r.id, public.document_filename(
               v_row->>'new_mafoi_id', 'PWD Certificate',
               r.first_name, r.last_name, public.file_extension(r.pwd_certificate_name))) end
     where r.id = (v_row->>'id')::uuid;
  end loop;

  -- Final invariant: serial numbers must be exactly 1..N.
  select count(*) into v_count from public.registrations;
  if exists (
    select 1 from (
      select serial_no, row_number() over (order by serial_no) as rn
        from public.registrations) t
     where t.serial_no <> t.rn) then
    raise exception 'REINDEX_INVARIANT_FAILED' using errcode = 'P0001';
  end if;

  return jsonb_build_object('deleted', p_id, 'remaining', v_count, 'reindexed', jsonb_array_length(v_plan->'rows'));
end $$;

revoke all on function public.compute_reindex_plan(uuid)          from public, anon, authenticated;
revoke all on function public.apply_delete_reindex(uuid, text)    from public, anon, authenticated;
grant execute on function public.compute_reindex_plan(uuid)       to service_role;
grant execute on function public.apply_delete_reindex(uuid, text) to service_role;


-- =====================================================================
--  8. STORAGE BUCKET + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deep-skilling-documents', 'deep-skilling-documents', false, 10485760,
        array['application/pdf','image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf','image/jpeg'];

-- Admins may read objects (needed to mint signed URLs from the dashboard).
-- Everything else (insert / move / delete) is service-role only, which
-- bypasses RLS — so no policy is granted for those actions.
drop policy if exists "admins read deep skilling documents" on storage.objects;
create policy "admins read deep skilling documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'deep-skilling-documents' and public.is_admin(auth.uid()));


-- =====================================================================
--  9. GRANTS HYGIENE
--     Nothing in `public` should be reachable by anon except the
--     registration status function.
-- =====================================================================
revoke all on public.registrations   from anon;
revoke all on public.admin_users     from anon;
revoke all on public.maintenance_state from anon, authenticated;
grant select on public.registrations to authenticated;   -- still filtered by RLS
grant select on public.admin_users   to authenticated;   -- still filtered by RLS
