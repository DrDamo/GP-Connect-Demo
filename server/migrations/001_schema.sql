-- GP Connect Demo schema (Postgres 18).
--
-- Recreates the schema that ran on Supabase, so it applies to an empty
-- database. Two roles are involved (both created by the server admin, see
-- docs/deployment-vps.md):
--
--   gpc      owns the database and these objects and runs the migrations.
--            Owners are not subject to row-level security, so the SECURITY
--            DEFINER helpers below (which run as gpc) can read profiles
--            without re-entering the policies that call them.
--   gpc_app  NOLOGIN. Every data request switches to it with SET LOCAL ROLE,
--            so the policies apply. gpc is a member of gpc_app.
--
-- The signed-in user for a request is carried in the transaction-local
-- setting app.user_id, which auth.uid() reads; the policies are unchanged
-- from Supabase apart from targeting gpc_app instead of "authenticated".

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gpc_app') then
    raise exception 'Role gpc_app is missing. Create it first: CREATE ROLE gpc_app NOLOGIN; GRANT gpc_app TO <owner role>;';
  end if;
end $$;

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- auth: accounts and sessions. Only the server's auth code touches these
-- tables, as the owner; gpc_app gets no access to them.
-- ---------------------------------------------------------------------------
create schema auth;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               citext not null unique,
  password_hash       text not null,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table auth.sessions (
  -- SHA-256 of the cookie value; the raw value is never stored.
  token_hash    bytea primary key,
  user_id       uuid not null references auth.users on delete cascade,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index sessions_user_idx on auth.sessions (user_id);
create index sessions_expires_idx on auth.sessions (expires_at);

create table auth.email_tokens (
  token_hash  bytea primary key,
  user_id     uuid not null references auth.users on delete cascade,
  purpose     text not null check (purpose in ('confirm_email')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index email_tokens_user_idx on auth.email_tokens (user_id);

-- The request's user, as set by the server: set_config('app.user_id', …, true).
create function auth.uid() returns uuid
  language sql stable
  set search_path = ''
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

grant usage on schema auth to gpc_app;
grant execute on function auth.uid() to gpc_app;

-- ---------------------------------------------------------------------------
-- public
-- ---------------------------------------------------------------------------
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null unique,
  display_name   text,
  org_id         uuid references public.organisations (id),
  role           text not null default 'staff',
  created_at     timestamptz default now(),
  job_title      text,
  date_of_birth  date,
  address        text
);
create index profiles_org_id_idx on public.profiles (org_id);

create table public.patient_drafts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations (id),
  created_by    uuid references public.profiles (id),
  patient_name  text,
  nhs_number    text,
  draft_data    jsonb not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  name          text,
  description   text,
  version       integer not null default 1
);
create index patient_drafts_org_updated_idx on public.patient_drafts (org_id, updated_at desc);
create index patient_drafts_created_by_idx on public.patient_drafts (created_by);

create table public.training_content (
  id          uuid primary key default gen_random_uuid(),
  page_id     text not null unique,
  content     text not null,
  version     integer not null default 1,
  updated_by  uuid references public.profiles (id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index training_content_updated_by_idx on public.training_content (updated_by);

create table public.training_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations (id),
  page_id     text not null,
  created_by  uuid not null references public.profiles (id),
  body        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index training_notes_org_page_idx on public.training_notes (org_id, page_id);
create index training_notes_created_by_idx on public.training_notes (created_by);

create table public.user_tour_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tour_id       text not null,
  completed_at  timestamptz not null default now(),
  primary key (user_id, tour_id)
);

create table public.user_hint_dismissals (
  user_id       uuid not null references auth.users (id) on delete cascade,
  hint_id       text not null,
  dismissed_at  timestamptz not null default now(),
  primary key (user_id, hint_id)
);

create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers used by the policies. SECURITY DEFINER = run as the owner, which
-- is not subject to RLS.
-- ---------------------------------------------------------------------------
create function public.current_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$ select org_id from public.profiles where id = (select auth.uid()) $$;

create function public.current_user_role() returns text
  language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create function public.current_username() returns text
  language sql stable security definer set search_path = ''
as $$ select username from public.profiles where id = (select auth.uid()) $$;

create function public.is_platform_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_admins where user_id = (select auth.uid())) $$;

create function public.set_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

-- Updates can never move a row to another organisation or author.
create function public.pin_ownership_columns() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.org_id     := old.org_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke execute on all functions in schema public from public;
grant execute on function public.current_org_id(), public.current_user_role(),
  public.current_username(), public.is_platform_admin() to gpc_app;

create trigger patient_drafts_updated_at before update on public.patient_drafts
  for each row execute function public.set_updated_at();
create trigger patient_drafts_pin_ownership before update on public.patient_drafts
  for each row execute function public.pin_ownership_columns();
create trigger training_content_updated_at before update on public.training_content
  for each row execute function public.set_updated_at();
create trigger training_notes_updated_at before update on public.training_notes
  for each row execute function public.set_updated_at();
create trigger training_notes_pin_ownership before update on public.training_notes
  for each row execute function public.pin_ownership_columns();

-- ---------------------------------------------------------------------------
-- Row-level security (as on Supabase)
-- ---------------------------------------------------------------------------
alter table public.organisations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.patient_drafts       enable row level security;
alter table public.training_content     enable row level security;
alter table public.training_notes       enable row level security;
alter table public.user_tour_progress   enable row level security;
alter table public.user_hint_dismissals enable row level security;
alter table public.platform_admins      enable row level security;

grant usage on schema public to gpc_app;
grant select, update on public.organisations to gpc_app;
grant select, update on public.profiles to gpc_app;
grant select, insert, update, delete on public.patient_drafts, public.training_content,
  public.training_notes, public.user_tour_progress, public.user_hint_dismissals to gpc_app;
-- platform_admins: no access; is_platform_admin() reads it as the owner.

create policy org_members_read_org on public.organisations for select to gpc_app
  using (id = public.current_org_id());
create policy admin_update_org on public.organisations for update to gpc_app
  using (id = public.current_org_id() and public.current_user_role() = 'admin')
  with check (id = public.current_org_id());

create policy read_profiles on public.profiles for select to gpc_app
  using (id = (select auth.uid()) or org_id = public.current_org_id());
create policy update_own_profile on public.profiles for update to gpc_app
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id
    and org_id = public.current_org_id()
    and role = public.current_user_role()
    and username = public.current_username());

create policy org_select_drafts on public.patient_drafts for select to gpc_app
  using (org_id = public.current_org_id());
create policy org_insert_drafts on public.patient_drafts for insert to gpc_app
  with check (org_id = public.current_org_id() and created_by = (select auth.uid()));
create policy org_update_drafts on public.patient_drafts for update to gpc_app
  using (org_id = public.current_org_id());
create policy org_delete_drafts on public.patient_drafts for delete to gpc_app
  using (org_id = public.current_org_id());

create policy authenticated_read_training_content on public.training_content for select to gpc_app
  using ((select auth.uid()) is not null);
create policy platform_admin_insert_training_content on public.training_content for insert to gpc_app
  with check ((select public.is_platform_admin()) and updated_by = (select auth.uid()));
create policy platform_admin_update_training_content on public.training_content for update to gpc_app
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()) and updated_by = (select auth.uid()));
create policy platform_admin_delete_training_content on public.training_content for delete to gpc_app
  using ((select public.is_platform_admin()));

create policy org_select_training_notes on public.training_notes for select to gpc_app
  using (org_id = public.current_org_id());
create policy org_insert_training_notes on public.training_notes for insert to gpc_app
  with check (org_id = public.current_org_id() and created_by = (select auth.uid()));
create policy author_or_admin_update_training_notes on public.training_notes for update to gpc_app
  using (org_id = public.current_org_id()
    and (created_by = (select auth.uid()) or public.current_user_role() = 'admin'));
create policy author_or_admin_delete_training_notes on public.training_notes for delete to gpc_app
  using (org_id = public.current_org_id()
    and (created_by = (select auth.uid()) or public.current_user_role() = 'admin'));

create policy own_tour_progress on public.user_tour_progress for all to gpc_app
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_hint_dismissals on public.user_hint_dismissals for all to gpc_app
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
