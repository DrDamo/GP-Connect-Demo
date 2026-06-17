-- ============================================================
-- GP Connect Demo — initial schema
-- Run this in the Supabase SQL Editor for your project
-- ============================================================

-- Organisations
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- Profiles (one per auth.users row)
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  display_name text,
  org_id       uuid references public.organisations(id),
  role         text not null default 'staff',
  created_at   timestamptz default now()
);

-- Shared patient drafts
create table public.patient_drafts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id),
  created_by   uuid references public.profiles(id),
  patient_name text,
  nhs_number   text,
  draft_data   jsonb not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger patient_drafts_updated_at
  before update on public.patient_drafts
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.organisations  enable row level security;
alter table public.profiles        enable row level security;
alter table public.patient_drafts  enable row level security;

-- Organisations: members can read their own org
create policy "org_members_read_org" on public.organisations
  for select using (
    id = (select org_id from public.profiles where id = auth.uid())
  );

-- Profiles: users can read their own profile
create policy "read_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Profiles: org members can read each other's profiles (for "created by" display)
create policy "org_members_read_profiles" on public.profiles
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Patient drafts: full CRUD within the same org
create policy "org_select_drafts" on public.patient_drafts
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

create policy "org_insert_drafts" on public.patient_drafts
  for insert with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

create policy "org_update_drafts" on public.patient_drafts
  for update using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

create policy "org_delete_drafts" on public.patient_drafts
  for delete using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );
