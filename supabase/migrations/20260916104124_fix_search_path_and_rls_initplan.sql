-- ============================================================
-- GP Connect Demo — search_path + RLS initplan fixes
--
-- Mirror of migration 20260916104124 that was applied directly to the live
-- project (via the Supabase dashboard/MCP) and was never committed here.
-- Kept byte-for-byte so `supabase db push` / `supabase migration list`
-- agree with the live schema_migrations table. Run after 007.
--
-- 1. set_updated_at() had a mutable search_path (Supabase lint 0011).
--    Pinning it to '' means an attacker who can create objects in a schema
--    on the caller's search_path can't shadow now() for this trigger.
-- 2. Policies that called auth.uid() directly were re-evaluated per row.
--    Wrapping in (select auth.uid()) makes Postgres evaluate it once per
--    statement as an InitPlan (Supabase lint 0003).
-- ============================================================

-- Fix mutable search_path on trigger function (search_path hijacking risk)
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

-- Fix RLS policies re-evaluating auth.uid() per row instead of once per query
ALTER POLICY read_own_profile ON public.profiles
  USING ((select auth.uid()) = id);

ALTER POLICY update_own_profile ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK (((select auth.uid()) = id) AND (org_id = current_org_id()) AND (role = current_user_role()));

ALTER POLICY authenticated_read_training_content ON public.training_content
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY org_insert_training_notes ON public.training_notes
  WITH CHECK ((org_id = current_org_id()) AND (created_by = (select auth.uid())));

ALTER POLICY author_or_admin_update_training_notes ON public.training_notes
  USING ((org_id = current_org_id()) AND ((created_by = (select auth.uid())) OR (current_user_role() = 'admin'::text)));

ALTER POLICY author_or_admin_delete_training_notes ON public.training_notes
  USING ((org_id = current_org_id()) AND ((created_by = (select auth.uid())) OR (current_user_role() = 'admin'::text)));
