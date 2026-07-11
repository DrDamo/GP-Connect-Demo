-- ============================================================
-- GP Connect Demo — account details + self-service profile/org editing
-- Run this in the Supabase SQL Editor after 001-005.
--
-- Adds optional personal-details columns to profiles, and RLS UPDATE
-- policies so a signed-in user can edit their own profile and (if
-- 'admin') their organisation's name from the new Account page.
-- ============================================================

alter table public.profiles
  add column if not exists job_title     text,
  add column if not exists date_of_birth date,
  add column if not exists address       text;

-- Users can update their own profile, but org_id/role/username are
-- pinned to their current values via current_org_id()/current_user_role()
-- (from 004_fix_rls_recursion.sql) so this can't be used to change org
-- membership, escalate role, or steal another user's username.
drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile" on public.profiles
  for update using ( auth.uid() = id )
  with check (
    auth.uid() = id
    and org_id = public.current_org_id()
    and role = public.current_user_role()
  );

-- Only an org's admin can rename the organisation.
drop policy if exists "admin_update_org" on public.organisations;
create policy "admin_update_org" on public.organisations
  for update using (
    id = public.current_org_id()
    and public.current_user_role() = 'admin'
  )
  with check ( id = public.current_org_id() );
