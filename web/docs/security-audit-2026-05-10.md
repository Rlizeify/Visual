# Security Audit Report

**Repository**: https://github.com/Rlizeify/Visual.git
**Status**: PUBLIC
**Audit Date**: 2026-05-10

---

## Section 1: Exposed Secrets in Git History

| # | Secret Type | Value | Location | Commit | Severity | Status |
|---|-------------|-------|----------|--------|----------|--------|
| 1 | Vercel Deployment Protection Bypass | `QKAaIulEMLIn...` (32 chars) | `.claude/memory/context/active.md` | `05f8f37` | **HIGH** | ROTATE REQUIRED |
| 2 | Hardcoded Super-Admin Email | `stone.gaunce@gmail.com` | `web/api/_admin.ts:9` | multiple | MEDIUM | Moved to env var |
| 3 | Hardcoded Admin Bootstrap Email | `cbauschek@gmail.com` | `.claude/memory/decisions/admin-bootstrap.md` | `c0bb3b4` | MEDIUM | Documentation only |
| 4 | Vercel Project ID | `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` | `.vercel/project.json` | `9228b92` | LOW | Untracked |
| 5 | Vercel Org/Team ID | `team_7EYLC40Z1T3Vhu7kx3bKmBFC` | `.vercel/project.json` | `9228b92` | LOW | Untracked |

### Not Found (Verified Clean)

| Secret Type | Pattern Searched | Result |
|-------------|-----------------|--------|
| .env files | `-- "*.env*"` | None committed |
| Supabase Service Role Key | `-S "SUPABASE_SERVICE_ROLE"` | Only env var references |
| Spotify Client Secret | `-S "SPOTIFY_CLIENT_SECRET"` | Only env var references |
| Discord Client Secret | `-S "DISCORD_CLIENT_SECRET"` | Only env var references |
| AWS Access Keys | `-S "AKIA"` | None |
| GitHub PAT | `-S "ghp_"` | None |
| Private Keys | `-S "-----BEGIN"` | None |
| JWTs | `-S "eyJ"` | None |
| Database URLs | `-S "postgres://"` | None |

---

## Section 2: Hardening Measures

| Control | Status | Notes |
|---------|--------|-------|
| Pre-commit secret scan hook | SHIPPED | `scripts/install-hooks.sh` |
| GitHub Actions gitleaks workflow | SHIPPED | `.github/workflows/secret-scan.yml` |
| `.vercel/` untracked | SHIPPED | `git rm --cached` applied |
| Admin emails in env var | SHIPPED | `SUPER_ADMIN_EMAILS` |
| Bypass token removed from repo | SHIPPED | Line deleted from active.md |

### Manual Steps Required

1. **Rotate Vercel bypass token** - Dashboard > Project Settings > Deployment Protection > Regenerate
2. **Add env var** - `SUPER_ADMIN_EMAILS=stone.gaunce@gmail.com` in Vercel
3. **Enable GitHub secret scanning** - Settings > Code security > Secret scanning > Enable

---

## Section 3: RLS Coverage

### Summary

All 19 public tables have RLS enabled (`rowsecurity = true`).

| Table | RLS | Policies | Assessment |
|-------|-----|----------|------------|
| audit_log | ON | 1 | OK - Admin read only |
| leaderboard_config | ON | 5 | OK - Admin write, public read visible |
| life_score_derivatives | ON | 6 | OK - User owns, admin reads, public reads leaderboard users |
| life_score_samples | ON | 5 | OK - User owns, admin reads |
| oauth_connections | ON | 5 | OK - User owns, admin reads |
| profiles | ON | 5 | OK - User owns, admin reads, public reads leaderboard users |
| recompute_locks | ON | 1 | OK - Service role only (qual=true for ALL cmd) |
| score_events | ON | 2 | OK - Public read, service insert |
| scoring_field_weights | ON | 2 | OK - Admin write, public read |
| tooltip_defaults | ON | 2 | OK - Admin write, public read |
| tooltip_overrides | ON | 3 | OK - Admin write, user reads own |
| user_listening_stats | ON | 1 | OK - User reads own (service writes) |
| user_position_history | ON | 2 | OK - Service role manages, user reads own |
| user_score_visibility | ON | 5 | OK - Admin manages, user reads own |
| user_scores | ON | 3 | REVIEW - NULL user_id allowed in INSERT/UPDATE |
| user_settings | ON | 0 | OK - RLS on, no policies = deny all (unused table) |
| users | ON | 3 | REVIEW - Public INSERT/UPDATE with with_check=true |
| visualizer_presets | ON | 4 | OK - Admin write, public read |
| wiki_entries | ON | 0 | OK - RLS on, no policies = deny all (unused table) |

### Detailed Policy Analysis

#### REVIEW: `users` table

```sql
-- Policy: Allow insert for Spotify login
INSERT with_check = true  -- Allows any INSERT

-- Policy: Allow update for Spotify login
UPDATE qual = true, with_check = true  -- Allows any UPDATE

-- Policy: Anyone can read users
SELECT qual = true  -- Intentional public read
```

**Assessment**: The INSERT/UPDATE policies with `with_check=true` are permissive. This is intentional for the Spotify OAuth flow where the backend (using service role key) upserts user records. Since service role bypasses RLS, these policies only affect anon/authenticated users. The `users` table contains non-sensitive Spotify profile data (display_name, spotify_id). **Risk: LOW** - an attacker could insert fake user records but cannot access other users' data or escalate privileges.

**Recommendation**: Consider tightening to service-role-only by removing these policies and relying on service role bypass.

#### REVIEW: `user_scores` table

```sql
-- Policy: Users can insert own score
INSERT with_check = ((auth.uid() = user_id) OR (user_id IS NULL))

-- Policy: Users can update own score
UPDATE qual = ((auth.uid() = user_id) OR (user_id IS NULL))
       with_check = ((auth.uid() = user_id) OR (user_id IS NULL))
```

**Assessment**: The `OR (user_id IS NULL)` clause allows inserting/updating rows without a user_id. This was likely added for legacy compatibility or edge cases. **Risk: LOW** - orphaned score records with NULL user_id wouldn't appear on leaderboards (which join on user_id).

**Recommendation**: Remove `OR (user_id IS NULL)` clause if not needed.

#### Service Role Policies (OK)

The following tables use `qual=true` and `with_check=true` for service-role-only access:

- `recompute_locks` - Rate limiting, managed by cron job
- `user_position_history` - Score history, managed by scoring engine
- `score_events` - Activity feed, managed by scoring engine

These are correct because:
1. The service role key (used by API routes) bypasses RLS entirely
2. Anon/authenticated users cannot insert/update (no matching policy for them)
3. The `true` qual is only applied when using service role

#### Public Read Policies (Intentional)

| Table | Purpose |
|-------|---------|
| score_events | Social activity feed |
| scoring_field_weights | Display weight sliders |
| tooltip_defaults | UI help text |
| user_scores | Leaderboard |
| users | Public profiles |
| visualizer_presets | Preset names |

All are read-only for public and contain non-sensitive data.

---

## Section 4: Recommendations

### Immediate (before next deploy)

1. Rotate Vercel deployment protection bypass token
2. Add `SUPER_ADMIN_EMAILS` to Vercel environment variables
3. Enable GitHub native secret scanning

### Future Hardening

1. Tighten `users` table INSERT/UPDATE to service-role-only
2. Remove `OR (user_id IS NULL)` from `user_scores` policies
3. Add INSERT/UPDATE policies to `user_listening_stats` if needed

---

## Appendix: Full Policy Dump

```
audit_log
  - Admins can read audit log (SELECT): is_admin(auth.uid())

leaderboard_config
  - Admins can delete leaderboard config (DELETE): is_admin(auth.uid())
  - Admins can insert leaderboard config (INSERT): is_admin(auth.uid())
  - Admins can read all leaderboard config (SELECT): is_admin(auth.uid())
  - Admins can update leaderboard config (UPDATE): is_admin(auth.uid())
  - Public can read visible leaderboard config (SELECT): (visible = true)

life_score_derivatives
  - Admins can read all life score derivatives (SELECT): is_admin(auth.uid())
  - Public can read leaderboard users' life score derivatives (SELECT): EXISTS(leaderboard_config.visible=true)
  - Users can delete own life score derivatives (DELETE): (auth.uid() = user_id)
  - Users can insert own life score derivatives (INSERT): (auth.uid() = user_id)
  - Users can read own life score derivatives (SELECT): (auth.uid() = user_id)
  - Users can update own life score derivatives (UPDATE): (auth.uid() = user_id)

life_score_samples
  - Admins can read all life score samples (SELECT): is_admin(auth.uid())
  - Users can delete own life score samples (DELETE): (auth.uid() = user_id)
  - Users can insert own life score samples (INSERT): (auth.uid() = user_id)
  - Users can read own life score samples (SELECT): (auth.uid() = user_id)
  - Users can update own life score samples (UPDATE): (auth.uid() = user_id)

oauth_connections
  - Admins can read all oauth connections (SELECT): is_admin(auth.uid())
  - Users can delete own oauth connections (DELETE): (auth.uid() = user_id)
  - Users can insert own oauth connections (INSERT): (auth.uid() = user_id)
  - Users can read own oauth connections (SELECT): (auth.uid() = user_id)
  - Users can update own oauth connections (UPDATE): (auth.uid() = user_id)

profiles
  - Admins can read all profiles (SELECT): is_admin(auth.uid())
  - Public can read leaderboard users' profiles (SELECT): EXISTS(leaderboard_config.visible=true)
  - Users can insert own profile (INSERT): (auth.uid() = id)
  - Users can read own profile (SELECT): (auth.uid() = id)
  - Users can update own profile (UPDATE): (auth.uid() = id)

recompute_locks
  - Service role can manage recompute locks (ALL): true

score_events
  - Anyone can read score events (SELECT): true
  - Service can insert score events (INSERT): true

scoring_field_weights
  - Admins can manage scoring weights (ALL): is_admin check
  - Anyone can read scoring weights (SELECT): true

tooltip_defaults
  - Admins can manage tooltip defaults (ALL): is_admin(auth.uid())
  - Anyone can read tooltip defaults (SELECT): true

tooltip_overrides
  - Admins can manage tooltip overrides (ALL): is_admin(auth.uid())
  - Admins can read all tooltip overrides (SELECT): is_admin(auth.uid())
  - Users can read own tooltip overrides (SELECT): (auth.uid() = user_id)

user_listening_stats
  - Users can read own listening stats (SELECT): (auth.uid() = user_id)

user_position_history
  - Service role can manage position history (ALL): true
  - Users can read own position history (SELECT): (auth.uid() = user_id)

user_score_visibility
  - Admins can delete visibility (DELETE): is_admin(auth.uid())
  - Admins can insert visibility (INSERT): is_admin(auth.uid())
  - Admins can read all visibility (SELECT): is_admin(auth.uid())
  - Admins can update visibility (UPDATE): is_admin(auth.uid())
  - Users can read own visibility (SELECT): (auth.uid() = user_id)

user_scores
  - Anyone can read scores (SELECT): true
  - Users can insert own score (INSERT): ((auth.uid() = user_id) OR (user_id IS NULL))
  - Users can update own score (UPDATE): ((auth.uid() = user_id) OR (user_id IS NULL))

user_settings
  - (no policies - RLS enabled, deny all)

users
  - Allow insert for Spotify login (INSERT): true
  - Allow update for Spotify login (UPDATE): true
  - Anyone can read users (SELECT): true

visualizer_presets
  - Admins can delete presets (DELETE): is_admin(auth.uid())
  - Admins can insert presets (INSERT): is_admin(auth.uid())
  - Admins can update presets (UPDATE): is_admin(auth.uid())
  - Anyone can read presets (SELECT): true

wiki_entries
  - (no policies - RLS enabled, deny all)
```
