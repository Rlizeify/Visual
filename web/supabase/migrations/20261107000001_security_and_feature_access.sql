-- Security hardening + per-feature access control.
--
-- STATUS: APPLIED 2026-11-08 (owner ran it in the SQL Editor; verified via
-- pg_catalog: table, trigger, 14 "Feature gate" policies, grants).
--
-- 1. PRIVILEGE ESCALATION FIX. anon/authenticated held table-wide
--    INSERT/UPDATE on public.profiles and the "Users can update own
--    profile" policy did not restrict columns, so any signed-in user could
--    PATCH /rest/v1/profiles?id=eq.<self> {"is_admin":true} and become an
--    admin (requireAdmin trusts profiles.is_admin). Audit on 2026-11-07:
--    both current admins were granted through the admin console (audit_log),
--    no sign of abuse. Fix: column-level grants + a trigger that rejects
--    is_admin/id changes from client roles (belt and braces).
-- 2. SECURITY DEFINER functions callable through /rest/v1/rpc by anon:
--    revoke EXECUTE where no client needs it; pin search_path.
-- 3. feature_access: one row per (user, feature) grant. Admin checkboxes
--    write it through /api/admin/users (service role). Clients can only
--    read their own rows. New users get the defaults (visualizer,
--    investing) from handle_new_user. Feature keys are free text so a new
--    tab needs no migration — see web/src/lib/features.ts.
--    has_feature() backs RESTRICTIVE RLS policies on each feature's tables,
--    so revoking a feature cuts data access, not just the UI.
-- 4. auth_throttle: lockout for /api/auth?action=signin-username
--    (5 failures / 15 min per username and per IP). Service role only.

BEGIN;

-- ── 1. profiles ─────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (username, display_name, avatar_url, accent_color, theme_id)
  ON public.profiles TO authenticated;
-- Rows are created by handle_new_user (definer) or the admin API.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profiles.is_admin and profiles.id are not client-writable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

-- ── 2. definer functions ────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.backfill_usernames() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(bytea, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(text) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.backfill_usernames() SET search_path = public, pg_temp;
ALTER FUNCTION public.spotify_tokens_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.obsession_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.encrypt_token(text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.decrypt_token(bytea, text) SET search_path = public, extensions, pg_temp;

-- ── 3. feature_access ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_access (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature    text NOT NULL CHECK (feature ~ '^[a-z][a-z0-9_-]{1,31}$'),
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_access FROM anon, authenticated;
GRANT SELECT ON public.feature_access TO authenticated;

CREATE POLICY "Users read own feature access" ON public.feature_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all feature access" ON public.feature_access
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_feature(f text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.feature_access WHERE user_id = auth.uid() AND feature = f)
$$;
REVOKE EXECUTE ON FUNCTION public.has_feature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_feature(text) TO authenticated;

-- Defaults for new accounts. Keep in sync with DEFAULT_FEATURES in
-- web/src/lib/features.ts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.feature_access (user_id, feature)
  VALUES (NEW.id, 'visualizer'), (NEW.id, 'investing')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill: everyone gets the defaults; Obsession stays with existing
-- admins and anyone who already has Obsession data.
INSERT INTO public.feature_access (user_id, feature)
SELECT id, f FROM public.profiles CROSS JOIN (VALUES ('visualizer'), ('investing')) v(f)
ON CONFLICT DO NOTHING;
INSERT INTO public.feature_access (user_id, feature)
SELECT id, 'obsession' FROM public.profiles WHERE is_admin
UNION SELECT user_id, 'obsession' FROM public.obsession_preferences
UNION SELECT user_id, 'obsession' FROM public.obsession_meditations
UNION SELECT user_id, 'obsession' FROM public.obsession_lifts_sessions
UNION SELECT user_id, 'obsession' FROM public.obsession_training_goals
ON CONFLICT DO NOTHING;

-- Data-level gates: RESTRICTIVE policies AND with the existing per-user ones.
DO $$
DECLARE t text; f text;
BEGIN
  FOR t, f IN
    SELECT c.relname, CASE
      WHEN c.relname LIKE 'obsession\_%' THEN 'obsession'
      WHEN c.relname IN ('option_candidates', 'investing_scenarios') THEN 'investing'
      WHEN c.relname = 'spotify_tokens' THEN 'visualizer'
    END
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND (c.relname LIKE 'obsession\_%' OR c.relname IN ('option_candidates', 'investing_scenarios', 'spotify_tokens'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Feature gate" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Feature gate" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.has_feature(%L))) WITH CHECK ((SELECT public.has_feature(%L)))', t, f, f);
  END LOOP;
END $$;

-- ── 4. auth_throttle ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_throttle (
  key          text PRIMARY KEY,
  failures     int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
ALTER TABLE public.auth_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_throttle FROM anon, authenticated;

-- Returns seconds until unlock (0 = not locked).
CREATE OR REPLACE FUNCTION public.auth_throttle_locked(p_keys text[])
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(max(ceil(extract(epoch FROM locked_until - now())))::int, 0)
  FROM public.auth_throttle WHERE key = ANY(p_keys) AND locked_until > now()
$$;

CREATE OR REPLACE FUNCTION public.auth_throttle_fail(p_keys text[])
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO public.auth_throttle AS t (key, failures, window_start)
  SELECT k, 1, now() FROM unnest(p_keys) k
  ON CONFLICT (key) DO UPDATE SET
    failures = CASE WHEN t.window_start < now() - interval '15 minutes' THEN 1 ELSE t.failures + 1 END,
    window_start = CASE WHEN t.window_start < now() - interval '15 minutes' THEN now() ELSE t.window_start END,
    locked_until = CASE
      WHEN t.window_start >= now() - interval '15 minutes' AND t.failures + 1 >= 5
      THEN now() + interval '15 minutes' ELSE t.locked_until END
$$;

CREATE OR REPLACE FUNCTION public.auth_throttle_clear(p_keys text[])
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  DELETE FROM public.auth_throttle WHERE key = ANY(p_keys)
$$;

REVOKE EXECUTE ON FUNCTION public.auth_throttle_locked(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_throttle_fail(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_throttle_clear(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_throttle_locked(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_throttle_fail(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_throttle_clear(text[]) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
