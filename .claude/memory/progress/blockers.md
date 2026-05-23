# Blockers

## Cannot delete `Desktop` and `web-app` remote branches
**Since**: 2026-05-22
**Waiting on**: Stone — manual GitHub UI step (gh CLI not installed locally)
**Impact**: Repo still has 3 remote branches (`Desktop`, `main`, `web-app`) instead of 1.

### Why this is blocked
GitHub's current default branch is `web-app` (confirmed via `git remote show origin`). Git refuses to delete the default branch on the remote. Without `gh` CLI or a PAT, this can only be done from the GitHub web UI.

### Manual steps for Stone
1. Open https://github.com/Rlizeify/Visual/settings/branches.
2. Under "Default branch", click the switch icon and change from `web-app` to `main`.
3. Confirm the change.
4. Then run locally (or I can run on next session):
   ```
   git push origin --delete Desktop
   git push origin --delete web-app
   git remote set-head origin main
   ```
5. Also update the Vercel project production branch to `main` if it isn't already (Vercel project `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` — Settings -> Git -> Production Branch).

### State as of this commit
- `origin/main` exists and mirrors the keeper state (Desktop HEAD `333226a`).
- `origin/Desktop` also mirrors `333226a`.
- `origin/web-app` is at `7537b70` (stale, 1000+ insertions behind).
- `origin/refactor/consolidate` and `origin/claude/lucid-payne-2538da` deleted.
