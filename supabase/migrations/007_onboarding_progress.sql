-- Run this in the Supabase SQL Editor after 006_account_details.sql.
-- Adds per-user tracking of completed in-app onboarding tours and dismissed
-- info-hint tooltips, so state follows the user across devices/browsers.
-- No org-scoping needed here (self-row only), so no helper function is
-- required — see 004_fix_rls_recursion.sql for why that's normally needed.

create table public.user_tour_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  tour_id      text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);

create table public.user_hint_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  hint_id      text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, hint_id)
);

alter table public.user_tour_progress enable row level security;
alter table public.user_hint_dismissals enable row level security;

create policy "own_tour_progress" on public.user_tour_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_hint_dismissals" on public.user_hint_dismissals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
