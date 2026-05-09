-- Create user_scores table for competition leaderboard
create table if not exists public.user_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  spotify_user_id text unique not null,
  display_name text not null,
  score numeric default 0 not null,
  listening_minutes numeric default 0 not null,
  top_genre text,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.user_scores enable row level security;

-- Anyone can read scores (for leaderboard)
create policy "Anyone can read scores"
  on public.user_scores
  for select
  using (true);

-- Users can insert their own score
create policy "Users can insert own score"
  on public.user_scores
  for insert
  with check (auth.uid() = user_id or user_id is null);

-- Users can update their own score
create policy "Users can update own score"
  on public.user_scores
  for update
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- Create index for leaderboard queries
create index if not exists idx_user_scores_score
  on public.user_scores(score desc);

create index if not exists idx_user_scores_spotify_user_id
  on public.user_scores(spotify_user_id);
