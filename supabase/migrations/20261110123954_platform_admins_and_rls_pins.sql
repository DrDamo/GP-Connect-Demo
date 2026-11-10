-- ============================================================
-- GP Connect Demo — platform admins for global training content,
-- and pin ownership columns in RLS / triggers.
--
-- 1. training_content is one shared copy for every organisation, but its
--    write policies only checked profiles.role = 'admin' — an org-level
--    role. Any org admin could therefore rewrite the guidance every other
--    organisation sees. Writes now require membership of platform_admins.
--
--    platform_admins is deliberately NOT a column on profiles: users can
--    update their own profile row, so a flag there would be one missed
--    WITH CHECK away from self-promotion. The table has RLS enabled and no
--    policies, and anon/authenticated have no grants, so it is invisible to
--    the API; it is managed with SQL by the project owner, e.g.
--      insert into public.platform_admins (user_id)
--      select id from public.profiles where username = 'someone@example.org';
--
-- 2. profiles.update_own_profile pinned org_id and role but not username,
--    although 006's comment says it did.
--
-- 3. patient_drafts inserts did not pin created_by, so a member could
--    attribute a draft to a colleague.
--
-- 4. UPDATE policies on patient_drafts and training_notes cannot see OLD,
--    so created_by / created_at (and, for admins on notes, org_id within
--    their own org) could be rewritten. A BEFORE UPDATE trigger now copies
--    them from OLD. RLS WITH CHECK runs after BEFORE triggers, so the
--    pinned values are what gets checked.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Platform admins
-- ------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  )
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant  execute on function public.is_platform_admin() to authenticated, service_role;

-- Seed the project owner's account.
insert into public.platform_admins (user_id)
select id from public.profiles where username = 'DrDamo'
on conflict (user_id) do nothing;

drop policy if exists "admin_insert_training_content" on public.training_content;
drop policy if exists "admin_update_training_content" on public.training_content;
drop policy if exists "admin_delete_training_content" on public.training_content;

create policy "platform_admin_insert_training_content" on public.training_content
  for insert to authenticated
  with check (
    (select public.is_platform_admin())
    and updated_by = (select auth.uid())
  );

create policy "platform_admin_update_training_content" on public.training_content
  for update to authenticated
  using ( (select public.is_platform_admin()) )
  with check (
    (select public.is_platform_admin())
    and updated_by = (select auth.uid())
  );

create policy "platform_admin_delete_training_content" on public.training_content
  for delete to authenticated
  using ( (select public.is_platform_admin()) );

-- ------------------------------------------------------------
-- 2. Pin username on self-service profile updates
-- ------------------------------------------------------------
create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select username from public.profiles where id = (select auth.uid())
$$;

revoke execute on function public.current_username() from public, anon;
grant  execute on function public.current_username() to authenticated, service_role;

alter policy "update_own_profile" on public.profiles
  with check (
    (select auth.uid()) = id
    and org_id   = public.current_org_id()
    and role     = public.current_user_role()
    and username = public.current_username()
  );

-- ------------------------------------------------------------
-- 3. Pin created_by on new patient drafts
-- ------------------------------------------------------------
alter policy "org_insert_drafts" on public.patient_drafts
  with check (
    org_id = public.current_org_id()
    and created_by = (select auth.uid())
  );

-- ------------------------------------------------------------
-- 4. Ownership columns cannot change on UPDATE
-- ------------------------------------------------------------
create or replace function public.pin_ownership_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.org_id     := old.org_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke execute on function public.pin_ownership_columns() from public, anon, authenticated;

drop trigger if exists patient_drafts_pin_ownership on public.patient_drafts;
create trigger patient_drafts_pin_ownership
  before update on public.patient_drafts
  for each row execute function public.pin_ownership_columns();

drop trigger if exists training_notes_pin_ownership on public.training_notes;
create trigger training_notes_pin_ownership
  before update on public.training_notes
  for each row execute function public.pin_ownership_columns();
