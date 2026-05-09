-- Add username column to profiles with validation constraints
-- Username requirements: 3-20 chars, lowercase letters/numbers/underscores only

-- Note: profiles.username column was added in migration 20260508000007 but without
-- the check constraint. This migration adds the validation.

-- Add check constraint for username format (if not already exists)
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username ~ '^[a-z0-9_]{3,20}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill existing users with generated usernames
-- Uses sanitized display_name or email prefix, handles collisions with numeric suffix
CREATE OR REPLACE FUNCTION public.backfill_usernames()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_row RECORD;
  base_username TEXT;
  new_username TEXT;
  suffix INT;
BEGIN
  FOR profile_row IN
    SELECT p.id, p.display_name, u.email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.username IS NULL
  LOOP
    -- Generate base username from display_name or email prefix
    IF profile_row.display_name IS NOT NULL AND profile_row.display_name != '' THEN
      base_username := regexp_replace(lower(profile_row.display_name), '[^a-z0-9_]', '', 'g');
    ELSIF profile_row.email IS NOT NULL THEN
      base_username := regexp_replace(lower(split_part(profile_row.email, '@', 1)), '[^a-z0-9_]', '', 'g');
    ELSE
      base_username := 'user';
    END IF;

    -- Ensure minimum length
    IF length(base_username) < 3 THEN
      base_username := base_username || repeat('_', 3 - length(base_username));
    END IF;

    -- Truncate to 17 chars to leave room for suffix
    base_username := left(base_username, 17);

    -- Find unique username with numeric suffix if needed
    new_username := base_username;
    suffix := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
      suffix := suffix + 1;
      new_username := base_username || suffix::text;
    END LOOP;

    -- Update the profile
    UPDATE public.profiles SET username = new_username WHERE id = profile_row.id;
  END LOOP;
END;
$$;

-- Run the backfill (comment out if running manually)
-- SELECT public.backfill_usernames();
