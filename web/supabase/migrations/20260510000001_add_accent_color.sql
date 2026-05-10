-- Add accent_color column to profiles for per-user theme customization
alter table public.profiles add column if not exists accent_color text default '#00dcc8';

comment on column public.profiles.accent_color is 'User-selected accent color hex code';
