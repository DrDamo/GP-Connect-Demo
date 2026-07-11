-- ============================================================
-- GP Connect Demo — fix RLS infinite recursion (error 42P17)
-- Run this in the Supabase SQL Editor after 001, 002, 003.
--
-- Root cause: several policies check the caller's own org_id/role by
-- selecting from public.profiles from *inside* a policy defined *on*
-- public.profiles (or on a table whose policy itself reads profiles,
-- which has its own recursive profiles policy). Postgres detects this
-- self-reference and refuses the query with "infinite recursion
-- detected in policy for relation profiles" (SQLSTATE 42P17).
--
-- Fix: read the caller's own org_id/role via a SECURITY DEFINER helper
-- function. Because the function runs with the privileges of its
-- owner, its internal SELECT on profiles bypasses RLS entirely,
-- breaking the cycle.
-- ============================================================

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- profiles
drop policy if exists "org_members_read_profiles" on public.profiles;
create policy "org_members_read_profiles" on public.profiles
  for select using ( org_id = public.current_org_id() );

-- organisations
drop policy if exists "org_members_read_org" on public.organisations;
create policy "org_members_read_org" on public.organisations
  for select using ( id = public.current_org_id() );

-- patient_drafts
drop policy if exists "org_select_drafts" on public.patient_drafts;
create policy "org_select_drafts" on public.patient_drafts
  for select using ( org_id = public.current_org_id() );

drop policy if exists "org_insert_drafts" on public.patient_drafts;
create policy "org_insert_drafts" on public.patient_drafts
  for insert with check ( org_id = public.current_org_id() );

drop policy if exists "org_update_drafts" on public.patient_drafts;
create policy "org_update_drafts" on public.patient_drafts
  for update using ( org_id = public.current_org_id() );

drop policy if exists "org_delete_drafts" on public.patient_drafts;
create policy "org_delete_drafts" on public.patient_drafts
  for delete using ( org_id = public.current_org_id() );

-- training_content
drop policy if exists "admin_insert_training_content" on public.training_content;
create policy "admin_insert_training_content" on public.training_content
  for insert with check ( public.current_user_role() = 'admin' );

drop policy if exists "admin_update_training_content" on public.training_content;
create policy "admin_update_training_content" on public.training_content
  for update using ( public.current_user_role() = 'admin' );

drop policy if exists "admin_delete_training_content" on public.training_content;
create policy "admin_delete_training_content" on public.training_content
  for delete using ( public.current_user_role() = 'admin' );

-- training_notes
drop policy if exists "org_select_training_notes" on public.training_notes;
create policy "org_select_training_notes" on public.training_notes
  for select using ( org_id = public.current_org_id() );

drop policy if exists "org_insert_training_notes" on public.training_notes;
create policy "org_insert_training_notes" on public.training_notes
  for insert with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
  );

drop policy if exists "author_or_admin_update_training_notes" on public.training_notes;
create policy "author_or_admin_update_training_notes" on public.training_notes
  for update using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'admin')
  );

drop policy if exists "author_or_admin_delete_training_notes" on public.training_notes;
create policy "author_or_admin_delete_training_notes" on public.training_notes
  for delete using (
    org_id = public.current_org_id()
    and (created_by = auth.uid() or public.current_user_role() = 'admin')
  );
