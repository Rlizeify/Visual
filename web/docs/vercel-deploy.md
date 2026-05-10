# Vercel Deployment Guide

## Critical: Project Linking

**ALWAYS deploy from the repo root**, not from `/web`.

The correct Vercel project is:
- **Project**: `project-iwmob`
- **Team**: `rlizeifys-projects`
- **ProjectId**: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR`
- **Domain**: `mheu.lol`
- **Root Directory** (in Vercel settings): `web`

### Why This Matters

The repo root contains `.vercel/project.json` linked to `project-iwmob` (which owns `mheu.lol`).

If you deploy from `/web`, Vercel may create a rogue `/web/.vercel/project.json` linked to a different project (`web`). Deployments then go to the wrong project, and `mheu.lol` returns 404.

### Deploy Commands

```bash
# From repo root (correct)
npx vercel --prod

# NEVER do this
cd web && npx vercel --prod  # WRONG - may create rogue link
```

### If Link Drifts

1. Delete any rogue `.vercel` directories:
   ```bash
   rm -rf web/.vercel
   ```

2. Verify root link:
   ```bash
   cat .vercel/project.json
   # projectName should be "project-iwmob"
   ```

3. If root link is wrong, re-link:
   ```bash
   rm -rf .vercel
   npx vercel link --yes
   # Select project-iwmob under team rlizeifys-projects
   ```

4. Run the guard script:
   ```bash
   bash scripts/check-vercel-link.sh
   ```

## Hobby Tier Limits

Vercel Hobby (free) tier has strict limits:

| Limit | Value | Current |
|-------|-------|---------|
| Serverless Functions | 12 max | **12** (at limit) |
| Cron Jobs | Daily only | `0 0 * * *` (midnight UTC) |
| Build timeout | 45 seconds | OK |

### Adding New Endpoints

**DO NOT** create new API files. Consolidate into existing endpoints using query params:

```typescript
// Instead of creating api/admin/new-feature.ts, add to existing:
// api/admin/users.ts?action=new-feature
// api/admin/scoring.ts?type=new-thing
```

Current endpoints (12/12):
- `admin/leaderboard.ts` - leaderboard + score visibility
- `admin/oauth.ts` - OAuth connections management
- `admin/presets.ts` - visualizer presets
- `admin/scoring.ts` - scoring weights + derivatives + user scores
- `admin/tooltips.ts` - tooltip defaults + overrides
- `admin/users.ts` - user CRUD + password reset/set
- `auth.ts` - auth + username lookup
- `cron/recompute.ts` - daily score recomputation
- `health.ts` - health check
- `oauth.ts` - OAuth flows (discord, mynetdiary)
- `scores.ts` - user score queries
- `settings.ts` - user settings

## Pre-Commit Guard

The pre-commit hook (installed via `bash scripts/install-hooks.sh`) includes:

1. **Vercel link guard** - Blocks commits if `web/.vercel` exists or root link drifted
2. **Secret scanning** - Blocks commits with exposed secrets

## Aliases

```bash
# Check current aliases
npx vercel alias ls | grep mheu

# Re-alias if needed
npx vercel alias set <deployment-url> mheu.lol
```
