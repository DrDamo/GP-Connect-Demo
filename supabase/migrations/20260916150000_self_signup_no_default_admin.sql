-- ============================================================
-- GP Connect Demo — self-signed-up users no longer default to 'admin'
-- Run after 20260916140058_scope_policies_to_authenticated.sql.
--
-- Fixes S-08 (code-review-2026-09-16.md): handle_new_user()
-- (005_self_serve_signup.sql) made every self-signed-up user 'admin' of
-- their brand-new organisation. 'admin' is also the role required to
-- write to public.training_content, which is a single shared version of
-- the training guide used by every organisation
-- (003_training_content_and_notes.sql). So anyone visiting the public
-- signup page could sign up and edit content every other organisation
-- sees.
--
-- This keeps self-signup itself unchanged — it still creates a new
-- organisation and adds the signing-up user as its only member — but
-- that user now gets 'staff' rather than 'admin'. The frontend already
-- handles the non-admin case for both places 'admin' is checked:
--   - src/account/AccountPage.tsx:136-145 shows the organisation-name
--     field disabled with an explanatory hint instead of erroring.
--   - src/components/training/TrainingView.tsx:319 hides the training
--     "Edit" button entirely rather than showing one that would fail.
--
-- Trade-off accepted: since there is no in-app "promote to admin" flow,
-- 'admin' now has to be granted by hand from now on, e.g.
--   update public.profiles set role = 'admin' where id = '<user id>';
-- which also means a self-signed-up user can no longer rename their own
-- organisation (admin_update_org, 006_account_details.sql) without that
-- manual step. Acceptable for a repo-owner-operated demo; would need
-- revisiting for a self-serve product with real customers.
--
-- Does NOT change any already-existing profile's role. At review time
-- three self-signed-up accounts (nhs.net addresses) were already
-- 'admin' from the old trigger and can still edit training_content —
-- that is a separate decision for the repo owner, not something this
-- migration touches.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_org_id uuid;
begin
  if meta->>'self_signup' is distinct from 'true' then
    return new;
  end if;

  insert into public.organisations (name)
  values (coalesce(nullif(meta->>'org_name', ''), split_part(new.email, '@', 1) || '''s Workspace'))
  returning id into new_org_id;

  insert into public.profiles (id, username, display_name, org_id, role)
  values (
    new.id,
    new.email,
    nullif(meta->>'display_name', ''),
    new_org_id,
    'staff'
  );

  return new;
end;
$$;
