# Visual Web

Web app for Visual - a multi-window synthesizer with real-time audio visualization.

## Development

```bash
npm install
npm run dev
```

## Production Deployment

Deploy to Vercel from the `web/` directory.

## Production Env Vars

These environment variables must be set in Vercel for the API routes to function:

| Variable | Required By | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | `api/_db.ts` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `api/_db.ts` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/admin/*.ts` | Supabase service role key (admin operations) |
| `JWT_SECRET` | `api/_jwt.ts` | Secret for signing session JWTs |

Additionally, for the Vite client build:

| Variable | Required By | Description |
|----------|-------------|-------------|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` | Same as SUPABASE_URL, exposed to client |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | Same as SUPABASE_ANON_KEY, exposed to client |

### Admin

| Variable | Required By | Description |
|----------|-------------|-------------|
| `SUPER_ADMIN_EMAILS` | `api/_admin.ts` | Comma-separated super-admin emails for force-set password. Default: `stone.gaunce@gmail.com` |
| `VITE_SUPER_ADMIN_EMAILS` | `src/components/admin/PasswordsTab.tsx` | Same as above, exposed to client for UI gating |
| `CRON_SECRET` | `api/cron/recompute.ts` | Secret for cron job authorization (optional in dev) |

### OAuth Providers

| Variable | Required By | Description |
|----------|-------------|-------------|
| `DISCORD_CLIENT_ID` | `api/oauth.ts` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | `api/oauth.ts` | Discord OAuth app client secret |
| `DISCORD_REDIRECT_URI` | `api/oauth.ts` | Discord OAuth redirect URI (defaults to auto-detect) |

## Connectors

External integrations supported by the app:

| Integration | Type | Env Vars | Description |
|-------------|------|----------|-------------|
| **Discord** | OAuth2 | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Social login and community features via Discord account linking |
| **Spotify** | OAuth2 | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` | Music playback integration for audio visualization |
| **MyNet Diary** | API Key | None (user-provided key) | Nutrition tracking data import via user's personal API key |
| **Apple Health** | Native | N/A | iOS-only, not configured on web (handled by native app) |

See [docs/discord-oauth-setup.md](docs/discord-oauth-setup.md) for Discord setup instructions.

### Health Check

After deployment, verify env vars are present:

```
GET /api/health
```

Returns:
```json
{
  "ok": true,
  "env": {
    "SUPABASE_URL": true,
    "SUPABASE_ANON_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "JWT_SECRET": true
  },
  "timestamp": "2026-05-09T..."
}
```

If any env var is missing, `ok` will be `false` and the response status will be `503`.
