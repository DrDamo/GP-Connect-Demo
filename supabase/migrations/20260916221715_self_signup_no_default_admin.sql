-- ============================================================
-- GP Connect Demo — self-signup creates 'staff', not 'admin'
--
-- Mirror of migration 20260916221715 that was applied directly to the live
-- project and never committed. The SQL below is the statement recorded in
-- supabase_migrations.schema_migrations, unchanged. Supersedes the
-- handle_new_user() definition in 005_self_serve_signup.sql, which made
-- every self-signed-up user an 'admin'.
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
