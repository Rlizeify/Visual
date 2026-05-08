-- Life score samples: raw metric values from various sources
create table if not exists public.life_score_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null, -- e.g., 'spotify', 'mynetdiary', 'apple_health', 'manual'
  metric text not null, -- e.g., 'listening_hours', 'calories', 'steps', 'sleep_hours'
  value numeric not null,
  sampled_at timestamptz not null,
  created_at timestamptz default now() not null
);

-- Index for efficient time-series queries
create index idx_life_score_samples_lookup
  on public.life_score_samples(user_id, source, metric, sampled_at desc);

-- Enable RLS
alter table public.life_score_samples enable row level security;

-- Users can only read their own samples
create policy "Users can read own life score samples"
  on public.life_score_samples
  for select
  using (auth.uid() = user_id);

-- Users can insert their own samples
create policy "Users can insert own life score samples"
  on public.life_score_samples
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own samples
create policy "Users can update own life score samples"
  on public.life_score_samples
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own samples
create policy "Users can delete own life score samples"
  on public.life_score_samples
  for delete
  using (auth.uid() = user_id);


-- Life score derivatives: computed position, velocity, acceleration, jerk, snap
-- One row per user per metric, upserted on each computation
create table if not exists public.life_score_derivatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null,
  position numeric not null default 0,      -- Current value (0th derivative)
  velocity numeric not null default 0,      -- Rate of change (1st derivative)
  acceleration numeric not null default 0,  -- Rate of velocity change (2nd derivative)
  jerk numeric not null default 0,          -- Rate of acceleration change (3rd derivative)
  snap numeric not null default 0,          -- Rate of jerk change (4th derivative)
  computed_at timestamptz default now() not null,

  -- One derivative row per user per metric
  unique (user_id, metric)
);

-- Index for lookups
create index idx_life_score_derivatives_user on public.life_score_derivatives(user_id);

-- Enable RLS
alter table public.life_score_derivatives enable row level security;

-- Users can only read their own derivatives
create policy "Users can read own life score derivatives"
  on public.life_score_derivatives
  for select
  using (auth.uid() = user_id);

-- Users can insert their own derivatives
create policy "Users can insert own life score derivatives"
  on public.life_score_derivatives
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own derivatives
create policy "Users can update own life score derivatives"
  on public.life_score_derivatives
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own derivatives
create policy "Users can delete own life score derivatives"
  on public.life_score_derivatives
  for delete
  using (auth.uid() = user_id);
