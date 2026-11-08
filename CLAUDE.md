# Visual / MHEU

- **MHEU web app** (`/web`) — **active**. https://mheu.lol on Vercel.
  Landing (nav over an animated pointer-lit grid) + Visualizer (sign-in) +
  Investing (public, device storage, syncs when signed in) + hidden
  Obsession + slim Admin.
- **Visual desktop** (`/legacy/desktop`) — **retired**. Electron cockpit; no active work.

## Tech Stack (web)

- React 18 + TypeScript 5.4 + Vite 5 + react-router 7; Vercel serverless + Supabase
- Visualizer: Butterchurn 2.6 (WebGL Milkdrop), lazy chunk on `/m` only
- Audio: Web Audio API, one shared `AnalyserNode` fed by `getDisplayMedia`
  (tab/screen + system audio) or `getUserMedia` (mic). No installs, no cables.
- Styling: CSS custom properties in `web/src/styles/tokens.css` (single source)
- Tests: Vitest (`npm test`), Playwright (`npm run test:responsive`)

## Folder structure (web/src)

| Path | What |
|------|------|
| `app/routes.ts` | Route registry — every page is one entry |
| `app/shell/` | Shell, NavBar, ProfileDropdown, AccentPicker, Gate, obsession keystroke |
| `app/accent.ts` | `useAccent` / `useAccentSync` (red/teal/purple) |
| `app/spotifySession.ts` | Spotify link state; only `/m` waits on it |
| `pages/<name>/` | landing, auth (login/signup), visualizer route, admin |
| `features/<name>/` | investing, visualizer, spotify, obsession, admin (sections) |
| `components/` | LoadingScreen, admin table/modal/tabs |
| `lib/options/` | Black-Scholes engine (shared with `api/` market handler) |
| `styles/` | `tokens.css`, `fonts.css`, `global.css` (primitives: .btn, .input, .card…) |

## Adding a page

1. Build it in `src/pages/<name>/` or `src/features/<name>/` (default export).
2. Add ONE entry to `ROUTES` in `src/app/routes.ts`: `{ path, title,
   description, icon, requiresAuth, requiresRole?, feature?, hidden,
   navOrder, chrome, component: lazy(() => import(...)) }`.
   Router, nav, auth/feature gate and `<title>` follow automatically.
   Per-user access: add the key to `src/lib/features.ts`, set `feature`,
   and give its tables a RESTRICTIVE "Feature gate" policy on
   `has_feature('<key>')`. Admin → Users shows the checkbox automatically.
3. Optional admin tooling: one entry in `src/features/admin/sections.ts`.
4. Run `npm run test:responsive` — it walks the registry.

## Theme + accent

- Dark only. Raw scales (`--red-*` brand `#FF000A`, `--teal-*`, `--purple-*`,
  `--green-*`, `--gray-*`) → semantic tokens (`--surface-0..3`, `--text-*`,
  `--border*`, `--accent*`, `--danger/--warning/--success`, spacing, type, z).
- `<html data-accent="red|teal|purple">` remaps `--accent*`. Set pre-paint by
  the inline script in `index.html` (localStorage `mheu_accent`), then by
  `useAccent`. Signed in: `profiles.accent_color` (profile wins on sign-in;
  empty profile gets the device value).
- `.accent-red` / `.accent-green` pin a scope (Obsession is always red;
  Investing flips red↔neon green with the what-if gain/loss).
- No color literals outside `tokens.css` (sole exception: the Spotify QR pair).
  Every text/fill pair passes WCAG AA — table in `AUDIT.md`.

## Auth + providers

- Exactly one `AuthProvider` and one `ProfileProvider` (`src/App.tsx`).
- `Gate` (registry-driven): `requiresAuth` → `/login?next=…`;
  `requiresRole: 'admin'` → `profiles.is_admin` (UI only; API re-checks);
  `feature` → `public.feature_access` grant (UI; RLS `has_feature()` enforces).
  Defaults: visualizer + investing (`handle_new_user`); all else manual.
- `profiles.is_admin`/`id` are not client-writable (column grants + trigger).
  Only super admins (`SUPER_ADMIN_EMAILS`) can grant/revoke admin.
- Passwords: `src/lib/password.ts` (12+, upper/lower/digit/symbol, HIBP).
  Supabase Auth settings must match. Username sign-in locks after 5 fails.
- CSP etc. in `web/vercel.json`; the inline script in `index.html` is
  allowed by sha256 — edit it, update the hash.
- Obsession: registry entry with `hidden: true`, own lazy chunk (`h-*.js`).
  Opened only by typing "obsession" outside form fields (`useObsessionEgg`).
  Never add links, tiles, hints, sitemap/robots entries for it.

## Admin

Sections registry `src/features/admin/sections.ts`: Users, Passwords,
Presets. Every write goes through `web/api/_handlers/admin/*` with
`requireAdmin` from `web/api/_admin.ts` (the only admin helper).

## API Architecture (web)

Exactly **2** serverless functions in `web/api/` (Hobby limit is 12):

- `api/index.ts` — reads `?_route=` from `vercel.json` rewrites → `auth`,
  `health`, `market-snapshot`, `admin.users`, `admin.presets`.
- `api/cron.ts` — CRON_SECRET bearer gate, `?job=` → `keepalive`
  (daily 00:00 UTC) and `market-snapshot` (weekdays 21:30 UTC).

Underscore paths (`_handlers/`, `_admin.ts`, `_auth.ts`, `_db.ts`, `_jwt.ts`)
are excluded from the function count. Per-handler auth lives in each handler;
dispatchers never pre-validate (public GETs would break).

## Database

- Claude does all DB work itself through the Supabase MCP (`.mcp.json`,
  project ref `dbfsddgsawjufmqqwwha`); never ask the owner to paste SQL.
- Every schema change = a file in `web/supabase/migrations/` AND
  `apply_migration`. Verify with `execute_sql` against `pg_catalog`.
- Before destructive changes, export rows via `execute_sql` to
  `backups/db-<date>/<table>.json` + a row-count manifest (gitignored).
- Needs a local session where the MCP is authenticated (`/mcp`).
- Unapplied files say `STATUS: NOT APPLIED` in their header.

## Audio Pipeline Rule (web)

One MediaStream → one `AudioContext` → one shared `AnalyserNode` →
consumers (Butterchurn, signal meter, `useAudioSource()`). Do not create
a second analyser. Do not pass raw bins through React state.

## Responsive rules

- Mobile-first. Containers use `min()`/`clamp()`, never fixed px widths.
- `100dvh`, safe-area insets, touch targets ≥ 44px (`--tap`).
- No `white-space: nowrap` that can overflow; tables scroll inside a wrapper
  or stack (`.table--stack`). Charts size with `ResizeObserver`.
- Nav collapses to a menu under 768px. Menus/dialogs fit at 320px.
- `npm run test:responsive` (from `web/`): every registry route + /login,
  /signup, Obsession at 320–1920px, signed out and (with `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` in env) signed in as a temporary admin.
  Screenshots → `audit-screenshots/final/` (gitignored).

## Deployment

- Single branch `main`. Push → Vercel GitHub integration deploys (~60s).
- Manual deploy: `npx vercel --prod` from the repo root only, linked to
  `project-iwmob`; run `scripts/check-vercel-link.sh` first. Never create a
  new Vercel project. Never `web/.vercel`.
- RLS on every public table. Service-role key stays server-side.

## My Role

I am the project's AI engineering partner. I write, debug and refactor on
request, track decisions in `.claude/memory/`, maintain this file, and never
act beyond what is asked without documenting why.

## Key Files

| File | Purpose |
|------|---------|
| `AUDIT.md` | Audit + refactor record (contrast, bundle, dropped objects) |
| `.claude/memory/context/active.md` | Current working context |
| `.claude/memory/decisions/index.md` | Architecture decision log |
| `.claude/memory/progress/changelog.md` | Completed work log |
| `.claude/memory/progress/blockers.md` | Blocked items |

## Rules of Engagement

1. Read before writing. 2. Decompose, state the plan, then do it.
3. Ask when ambiguous and risky; act when low-risk, then document.
4. Commits: `type: description` (fix|feat|refactor|perf|docs|chore|test|style),
   imperative, <72 chars, body explains why.
5. After every task: update `context/active.md` and `progress/changelog.md`.
6. At session start: read `context/active.md` and `progress/blockers.md`.
7. Pattern seen twice → `patterns/index.md`. Decision → `decisions/index.md`.

## Archive Policy

No archive folder any more. Retired code lives in git history; delete dead
code, failed experiments and stale branches outright. Ask when in doubt.

## Do Not

- Delete working features without explicit confirmation
- Refactor without a reason tied to the current task
- Add features, tests or docs beyond what was asked
- Exceed 198 lines in this file
- Commit without a user request; force-push `main`
- Hard-code colors outside `tokens.css`

## Pre-authorized Edits

`.claude/settings.json` pre-authorizes Edit/Write for `.claude/`, root
markdown, `.gitignore`, `web/docs/`, `web/supabase/migrations/`,
`web/public/`. Denied: `.env*` at repo root or `web/`, `web/.vercel/`.
Application source still goes through normal permission prompts.

## Self-Check

Every time this file is updated, count lines and confirm ≤ 198.
