-- Enable pgcrypto for token encryption
create extension if not exists pgcrypto;

-- Provider enum for supported OAuth providers
create type oauth_provider as enum ('spotify', 'discord', 'youtube', 'mynetdiary', 'apple');

-- OAuth connections table with encrypted tokens
create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider oauth_provider not null,
  -- Tokens encrypted with pgcrypto using a server-side key
  -- The encryption key should be stored in Supabase Vault or env vars
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  scope text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- One connection per provider per user
  unique (user_id, provider)
);

-- Index for lookups
create index idx_oauth_connections_user_provider on public.oauth_connections(user_id, provider);

-- Enable RLS
alter table public.oauth_connections enable row level security;

-- Users can only read their own connections
create policy "Users can read own oauth connections"
  on public.oauth_connections
  for select
  using (auth.uid() = user_id);

-- Users can insert their own connections
create policy "Users can insert own oauth connections"
  on public.oauth_connections
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own connections
create policy "Users can update own oauth connections"
  on public.oauth_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own connections
create policy "Users can delete own oauth connections"
  on public.oauth_connections
  for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger oauth_connections_updated_at
  before update on public.oauth_connections
  for each row execute function public.update_updated_at();

-- Helper function to encrypt tokens (use with service role only)
-- Example: SELECT encrypt_token('my_access_token', 'encryption_key_from_vault');
create or replace function public.encrypt_token(token text, key text)
returns bytea
language plpgsql
security definer
as $$
begin
  return pgp_sym_encrypt(token, key);
end;
$$;

-- Helper function to decrypt tokens (use with service role only)
create or replace function public.decrypt_token(encrypted_token bytea, key text)
returns text
language plpgsql
security definer
as $$
begin
  return pgp_sym_decrypt(encrypted_token, key);
end;
$$;
