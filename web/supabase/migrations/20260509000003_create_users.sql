-- Create users table for Spotify-authenticated users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique not null,
  display_name text,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Anyone can read users (for leaderboard display)
create policy "Anyone can read users"
  on public.users
  for select
  using (true);

-- Allow insert for Spotify OAuth flow (no Supabase auth context)
create policy "Allow insert for Spotify login"
  on public.users
  for insert
  with check (true);

-- Allow update for Spotify OAuth flow (no Supabase auth context)
create policy "Allow update for Spotify login"
  on public.users
  for update
  using (true)
  with check (true);

-- Create index for faster lookups by spotify_id
create index if not exists idx_users_spotify_id
  on public.users(spotify_id);
