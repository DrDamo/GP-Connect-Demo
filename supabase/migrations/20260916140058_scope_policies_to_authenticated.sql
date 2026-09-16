-- ============================================================
-- GP Connect Demo — scope every RLS policy to `authenticated`
-- Applied live as version 20260916140058. Run after 20260916135814.
--
-- Every policy was created FOR ... TO public, so Postgres evaluates them
-- for anon too. With EXECUTE on current_org_id()/current_user_role()
-- revoked from anon (20260916135814_security_hardening.sql), an anon query
-- against these tables failed with 42501 "permission denied for function
-- current_org_id" instead of returning no rows. Scoping the policies to
-- `authenticated` makes anon short-circuit to "no policy applies" (empty
-- result / no-op), which is the intended outcome and also what Supabase's
-- RLS performance guidance recommends:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#specify-roles-in-your-policies
-- ============================================================
alter policy "org_members_read_org" on public.organisations to authenticated;
alter policy "admin_update_org"     on public.organisations to authenticated;

alter policy "org_select_drafts" on public.patient_drafts to authenticated;
alter policy "org_insert_drafts" on public.patient_drafts to authenticated;
alter policy "org_update_drafts" on public.patient_drafts to authenticated;
alter policy "org_delete_drafts" on public.patient_drafts to authenticated;

alter policy "update_own_profile" on public.profiles to authenticated;

alter policy "authenticated_read_training_content" on public.training_content to authenticated;
alter policy "admin_insert_training_content"       on public.training_content to authenticated;
alter policy "admin_update_training_content"       on public.training_content to authenticated;
alter policy "admin_delete_training_content"       on public.training_content to authenticated;

alter policy "org_select_training_notes"              on public.training_notes to authenticated;
alter policy "org_insert_training_notes"              on public.training_notes to authenticated;
alter policy "author_or_admin_update_training_notes"  on public.training_notes to authenticated;
alter policy "author_or_admin_delete_training_notes"  on public.training_notes to authenticated;

alter policy "own_tour_progress"   on public.user_tour_progress   to authenticated;
alter policy "own_hint_dismissals" on public.user_hint_dismissals to authenticated;
