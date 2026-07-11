-- ============================================================
-- GP Connect Demo — training content editor + org notes
-- Run this in the Supabase SQL Editor after 001 and 002.
-- ============================================================

-- Global training content overrides (one shared version across all orgs).
-- Keyed by page_id (the same PageId shown in the UI — DomainId | ApiPageId),
-- NOT by the underlying .md file names. One flat markdown blob per page.
create table public.training_content (
  id          uuid primary key default gen_random_uuid(),
  page_id     text not null unique,
  content     text not null,
  version     integer not null default 1,
  updated_by  uuid references public.profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create trigger training_content_updated_at
  before update on public.training_content
  for each row execute procedure public.set_updated_at();

-- Org-scoped informal notes on a training page.
create table public.training_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id),
  page_id     text not null,
  created_by  uuid not null references public.profiles(id),
  body        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create trigger training_notes_updated_at
  before update on public.training_notes
  for each row execute procedure public.set_updated_at();

create index training_notes_org_page_idx on public.training_notes (org_id, page_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.training_content enable row level security;
alter table public.training_notes   enable row level security;

-- training_content: any authenticated user can read.
create policy "authenticated_read_training_content" on public.training_content
  for select using (auth.uid() is not null);

-- training_content: only admins can insert/update/delete.
create policy "admin_insert_training_content" on public.training_content
  for insert with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "admin_update_training_content" on public.training_content
  for update using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "admin_delete_training_content" on public.training_content
  for delete using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- training_notes: any org member can read their org's notes.
create policy "org_select_training_notes" on public.training_notes
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- training_notes: any org member can insert, but only as themselves and
-- only into their own org.
create policy "org_insert_training_notes" on public.training_notes
  for insert with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
  );

-- training_notes: author or org admin can update.
create policy "author_or_admin_update_training_notes" on public.training_notes
  for update using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

-- training_notes: author or org admin can delete.
create policy "author_or_admin_delete_training_notes" on public.training_notes
  for delete using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );
