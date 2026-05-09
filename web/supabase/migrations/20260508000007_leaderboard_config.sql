-- Leaderboard config: which users (and in what order) appear on the public
-- /u tab leaderboard. Admin-managed via the admin console; everyone can read
-- visible rows so the unauthenticated /u path can render too.
--
-- Also adds `profiles.username` because the admin Users tab edits username +
-- display_name + is_admin together, and we don't have a username column yet.
-- Per spec migrations 7 and 8 cover the admin console; folding the column add
-- here keeps the migration count to what's specified.

alter table public.profiles
  add column if not exists username text;

-- Username uniqueness when present (nulls allowed so existing rows don't break).
create unique index if not exists idx_profiles_username_unique
  on public.profiles (username)
  where username is not null;

create table if not exists public.leaderboard_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  position integer not null,
  visible boolean not null default true,
  updated_at timestamptz default now() not null
);

create index if not exists idx_leaderboard_config_position
  on public.leaderboard_config(position);

alter table public.leaderboard_config enable row level security;

-- Public (anon + authenticated) read of visible rows so /u renders without auth.
create policy "Public can read visible leaderboard config"
  on public.leaderboard_config
  for select
  using (visible = true);

-- Admins additionally see hidden rows (so they can manage the off-board pool).
create policy "Admins can read all leaderboard config"
  on public.leaderboard_config
  for select
  using (public.is_admin(auth.uid()));

create policy "Admins can insert leaderboard config"
  on public.leaderboard_config
  for insert
  with check (public.is_admin(auth.uid()));

create policy "Admins can update leaderboard config"
  on public.leaderboard_config
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete leaderboard config"
  on public.leaderboard_config
  for delete
  using (public.is_admin(auth.uid()));

create trigger leaderboard_config_updated_at
  before update on public.leaderboard_config
  for each row execute function public.update_updated_at();
