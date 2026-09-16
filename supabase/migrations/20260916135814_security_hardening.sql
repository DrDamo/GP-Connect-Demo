-- ============================================================
-- GP Connect Demo — security + performance hardening
-- Applied live as version 20260916135814. Run after 20260916104124 (and after
-- 007_onboarding_progress.sql, which was applied live as 20260916135800).
--
-- Addresses the remaining Supabase advisor findings from the 2026-09-16
-- code review (see docs/code-review-2026-09-16.md):
--   * lint 0028/0029  SECURITY DEFINER functions executable by anon /
--                     authenticated via /rest/v1/rpc
--   * lint 0006       two overlapping permissive SELECT policies on profiles
--   * lint 0001       five foreign keys without a covering index
-- ============================================================

-- ------------------------------------------------------------
-- 1. SECURITY DEFINER helper functions
--
-- current_org_id() / current_user_role() read the *caller's own* profiles
-- row and bypass RLS only to break the profiles→profiles policy recursion
-- (see 004). They return nothing an authenticated caller couldn't already
-- read through read_own_profile, so leaving them callable by
-- `authenticated` is safe — and required, because RLS policy expressions
-- run with the privileges of the querying role. `anon` has no session, so
-- auth.uid() is null and both functions return null; there is no reason
-- to expose them, so EXECUTE is revoked from PUBLIC and anon.
--
-- handle_new_user() is a trigger function. Postgres refuses to call a
-- trigger-returning function directly, so /rpc/handle_new_user could never
-- run it, but it should still only be executable by the role that fires
-- the auth.users trigger (supabase_auth_admin).
-- ------------------------------------------------------------
revoke execute on function public.current_org_id()    from public, anon;
revoke execute on function public.current_user_role() from public, anon;
grant  execute on function public.current_org_id()    to authenticated, service_role;
grant  execute on function public.current_user_role() to authenticated, service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant  execute on function public.handle_new_user() to supabase_auth_admin;

-- ------------------------------------------------------------
-- 2. profiles: one SELECT policy instead of two overlapping ones
--
-- read_own_profile      : id = auth.uid()
-- org_members_read_profiles : org_id = current_org_id()
--
-- The second does NOT strictly subsume the first: profiles.org_id is
-- nullable, and a profile with a null org_id (nothing in the repo creates
-- one today, but the schema allows it) would be invisible to its own owner
-- under the org policy alone (null = null is not true). Both conditions are
-- therefore kept, OR-ed into a single permissive policy so Postgres
-- evaluates one policy per row instead of two. Scoped to `authenticated`;
-- anon could never match either branch anyway.
-- ------------------------------------------------------------
drop policy if exists "read_own_profile"          on public.profiles;
drop policy if exists "org_members_read_profiles" on public.profiles;
create policy "read_profiles" on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or org_id = public.current_org_id()
  );

-- ------------------------------------------------------------
-- 3. Covering indexes for foreign keys
--
-- org_id columns are filtered by every RLS policy (org_id = current_org_id())
-- so they are hit on every read of these tables. The Shared Patients list
-- reads patient_drafts ordered by updated_at within the org, so that index
-- is a composite that also covers the FK. The created_by / updated_by
-- indexes mainly speed up the FK integrity check when a profile row is
-- deleted (cascade from auth.users) and the created_by = auth.uid() branch
-- of the training_notes update/delete policies. All tables are small today;
-- the indexes are cheap insurance rather than a measured fix.
-- ------------------------------------------------------------
create index if not exists patient_drafts_org_updated_idx
  on public.patient_drafts (org_id, updated_at desc);
create index if not exists patient_drafts_created_by_idx
  on public.patient_drafts (created_by);
create index if not exists profiles_org_id_idx
  on public.profiles (org_id);
create index if not exists training_content_updated_by_idx
  on public.training_content (updated_by);
create index if not exists training_notes_created_by_idx
  on public.training_notes (created_by);
