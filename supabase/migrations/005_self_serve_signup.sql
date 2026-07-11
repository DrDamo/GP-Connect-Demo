-- ============================================================
-- GP Connect Demo — self-serve signup
-- Run this in the Supabase SQL Editor after 001-004.
--
-- Public signup (LandingPage -> SignupPage) calls supabase.auth.signUp()
-- directly from the browser with the anon key. That can create an
-- auth.users row, but it can't create the matching organisations/profiles
-- rows because those tables have no public INSERT policy (by design —
-- see 001_initial.sql). This trigger fills that gap: on every new
-- auth.users row flagged with user_metadata.self_signup = 'true', it
-- provisions a brand-new organisation and makes the signing-up user its
-- 'admin'.
--
-- Admin-provisioned accounts (scripts/setup-user.mjs,
-- scripts/repair-auth-user.mjs) do NOT set self_signup, and continue to
-- create their organisation/profile rows manually — this trigger is a
-- no-op for them.
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
    'admin'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
