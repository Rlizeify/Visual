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
