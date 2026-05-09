-- Create visualizer_presets table for admin preset renaming
create table if not exists public.visualizer_presets (
  id uuid primary key default gen_random_uuid(),
  original_name text not null unique,
  display_name text not null,
  updated_at timestamptz default now() not null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Enable RLS
alter table public.visualizer_presets enable row level security;

-- Anyone can read presets (needed for visualizer to load display names)
create policy "Anyone can read presets"
  on public.visualizer_presets
  for select
  using (true);

-- Only admins can insert presets
create policy "Admins can insert presets"
  on public.visualizer_presets
  for insert
  with check (public.is_admin(auth.uid()));

-- Only admins can update presets
create policy "Admins can update presets"
  on public.visualizer_presets
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Only admins can delete presets
create policy "Admins can delete presets"
  on public.visualizer_presets
  for delete
  using (public.is_admin(auth.uid()));

-- Create index for faster lookups by original_name
create index if not exists idx_visualizer_presets_original_name
  on public.visualizer_presets(original_name);
