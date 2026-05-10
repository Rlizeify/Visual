-- Feature pack 2026-05-10
-- 1. spotify_play_history (was referenced by scoring connector but missing)
-- 2. accent_color_palette (admin-managed presets)
-- 3. profiles.avatar_url (user uploads)
-- 4. app_settings (single-row key/value config — e.g. allow_custom_hex)
-- 5. avatars storage bucket + policies
-- 6. oauth_connections schema fixes (text tokens for AES-GCM, provider_user_id)

-- 6. oauth_connections schema fixes ------------------------------------------
-- Switch token columns from bytea (legacy pgp_sym) to text (AES-GCM string).
-- Any previously stored tokens are unusable across this change; wipe them so
-- the type cast is safe and users will re-connect on next page load.
delete from public.oauth_connections;

alter table public.oauth_connections
  alter column access_token_encrypted type text using '';

alter table public.oauth_connections
  alter column refresh_token_encrypted type text using null;

alter table public.oauth_connections
  add column if not exists provider_user_id text;

-- 1. spotify_play_history -----------------------------------------------------
create table if not exists public.spotify_play_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id text,
  track_name text,
  artist_id text,
  artist_name text,
  playlist_id text,
  genre text,
  duration_ms integer,
  played_at timestamptz not null,
  created_at timestamptz default now() not null,
  unique (user_id, track_id, played_at)
);

create index if not exists idx_spotify_play_history_user_played_at
  on public.spotify_play_history (user_id, played_at desc);

alter table public.spotify_play_history enable row level security;

create policy "Users can read own play history"
  on public.spotify_play_history
  for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS, no need for INSERT policy.

-- 2. accent_color_palette -----------------------------------------------------
create table if not exists public.accent_color_palette (
  id uuid primary key default gen_random_uuid(),
  hex text not null,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz default now() not null
);

alter table public.accent_color_palette enable row level security;

create policy "Anyone can read palette"
  on public.accent_color_palette
  for select
  using (active = true);

-- Seed the 8 presets that used to be hardcoded.
insert into public.accent_color_palette (hex, label, sort_order)
values
  ('#00dcc8', 'Cyan',   0),
  ('#a855f7', 'Purple', 1),
  ('#ec4899', 'Pink',   2),
  ('#f97316', 'Orange', 3),
  ('#22c55e', 'Green',  4),
  ('#3b82f6', 'Blue',   5),
  ('#ef4444', 'Red',    6),
  ('#eab308', 'Yellow', 7)
on conflict do nothing;

-- 3. profiles.avatar_url ------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- 4. app_settings -------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now() not null
);

alter table public.app_settings enable row level security;

create policy "Anyone can read app settings"
  on public.app_settings
  for select
  using (true);

insert into public.app_settings (key, value)
values ('allow_custom_hex', 'true'::jsonb)
on conflict (key) do nothing;

-- 5. avatars storage bucket ---------------------------------------------------
-- If this fails (rare permission edge case), create the bucket manually in
-- Supabase Storage UI: name=avatars, public=true.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read of avatars
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Avatars public read' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Avatars public read"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end $$;

-- Authenticated users can upload to their own folder
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Avatars user upload' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Avatars user upload"
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Avatars user update' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Avatars user update"
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Avatars user delete' and tablename = 'objects' and schemaname = 'storage') then
    create policy "Avatars user delete"
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
