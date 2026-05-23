# Theme System Audit — 2026-05-23

Audit performed before extracting the existing Frutiger Aero look into a
themeable plug-in and building two sibling themes (Asian Vibrant, AC-130
Thermal). Source of truth at this audit: commit `1896e70` on `main`.

## 1. E-tab inventory

The current E tab (`web/src/components/tabs/EntertainmentTab.tsx`) is a
thin wrapper: a centered "Entertainment / EXPANDING IN THE FUTURE" card,
then it mounts `<AccountPage />` for authenticated users.

`web/src/components/tabs/AccountPage.tsx` (681 lines) is where everything
account/customization lives:

| Surface | Component lines | Reads | Writes |
|---|---|---|---|
| Avatar circle + Upload button | 372-415 | `profiles.avatar_url`, `profiles.username` (initial fallback) | Supabase Storage `avatars/{user_id}/{ts}.{ext}`, `profiles.avatar_url` |
| Username edit | 419-459 | `profiles.username` | `profiles.username` (unique-check then update) |
| Email row | 462-476 | `auth.users.email` (via session) | — |
| Member-since + Last-login dates | 478-510 | `profiles.created_at`, `auth.users.last_sign_in_at` | — |
| Accent color picker (palette + custom hex) | 512-561 | `profiles.accent_color`, `accent_color_palette`, `app_settings(allow_custom_hex)` | `profiles.accent_color` |
| Connected services list (Spotify / Discord / MyNetDiary / Apple) | 566-617 | `oauth_connections` (via `/api/oauth?action=connections`), `localStorage` Spotify tokens | `/api/oauth?action=disconnect`, kicks Discord/MND/Spotify OAuth flows |
| MyNet Diary modal | 620-678 | local input | `/api/oauth?provider=mynetdiary` POST (server stores encrypted) |

**Not yet in AccountPage**: `reveal_action` toggles per score type
(currently admin-only via `/admin/ScoreVisibility`). The spec requires
moving these into the new profile dropdown — that requires loosening
`user_score_visibility` RLS to permit self-update.

**Not in AccountPage**: Theme switcher (does not exist yet — added in
PART 4).

**Sign-out**: not in AccountPage. Lives on `GearMenu` (the gear icon on
the M tab visualizer). The new dropdown will host it for cross-tab
visibility.

## 2. MHEU nav bar inventory

`web/src/components/MHEUShell.tsx` is the nav.

- Position: `fixed`, top:0, full width, 56px tall, `zIndex: 1000`.
- Layout: flex centered, 8px gap between four tab buttons (M/H/E/U).
- Background: `linear-gradient(180deg, rgba(0,20,30,0.85), rgba(0,20,30,0.4))` + `backdropFilter: blur(12px)`.
- Border-bottom: 1px solid `var(--accent-color-border)`.
- Font: `'HitmarkerText', monospace`.
- Tab buttons: padding 10×24, font 18px / 0.15em tracking, accent-tinted
  when active (gradient bg + accent border), dim otherwise.
- **Top-left corner is empty.** This is where the profile icon goes.
- Below the nav: a `fogStyle` overlay (rgba blue, blur 20px) sits on
  H/E/U routes to dim the visualizer; opacity 0 on M.

## 3. tokens.css inventory

`web/src/styles/tokens.css` (35 lines). All variables on `:root`.

### Color

- `--accent-color` — primary text / active button (per-user, default `#00dcc8`)
- `--accent-color-bright` — same as accent (kept as a slot for themes)
- `--accent-color-dim` — 60% alpha derivation
- `--accent-color-bg` — 8% alpha
- `--accent-color-border` — 40% alpha
- `--accent-color-glow` — 30% alpha
- `--color-teal-primary` (alias of accent — legacy)
- `--color-bg` — `#010103`
- `--color-panel-bg` — `rgba(0, 20, 30, 0.55)`
- `--color-panel-border` (alias of `--accent-color-border`)
- `--color-secondary` — `rgba(180, 240, 235, 0.7)`
- `--color-error` — `rgba(255, 100, 100, 0.85)`

### Semantic (feed magnitude)

- `--color-success`, `--color-success-bg`, `--color-success-border`
- `--color-danger`, `--color-danger-bg`, `--color-danger-border`

### List rows

- `--row-tint`, `--row-tint-hover` (white low-alpha for zebra striping)

### Typography

- `--font-ui` — `'HitmarkerText', monospace`

### Radius

- `--radius` — `8px` (default for soft-cornered surfaces)

**Verdict:** the token list is the Frutiger Aero contract. Themes must
provide a matching set (same names) plus may add theme-only tokens.

## 4. What the current "Frutiger Aero" look IS

Stylistic ingredients extracted from the live code:

- **Backdrop-filter blur** on the nav (`12px`), the H/E/U fog
  (`20px`), every `.glass-card` (`16px`), every panel/button on the
  visualizer (`12px`), and the GearMenu side panel. Heavy glass is
  the dominant visual.
- **Accent-tinted gradients** on most surfaces — `linear-gradient(135deg, var(--accent-color-bg), rgba(0,40,50,0.4), var(--accent-color-bg))` on glass cards; `linear-gradient(180deg, var(--accent-color-bg), rgba(0,0,0,0.05))` on active tabs and `aero-button`.
- **Dark navy/teal substrate** — `#010103` body, `rgba(0,20,30,0.5)` panel bg, accent everything.
- **Hitmarker monospace** body + display.
- **Square form controls** (`border-radius: 0` on `input`/`select`/`button` globally), with `--radius: 8px` only on opt-in surfaces (Controls bar, GearMenu, panels).
- **Per-user accent everywhere** — the chrome literally repaints when
  the user picks a new accent color. The full palette derives from the
  one accent hex via `applyAccentColor()`.
- **Decorative**: shadow plus inner-highlight on `.glass-card`
  (`box-shadow: 0 8px 32px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.1)`). Prestige pulse keyframes (`prestigePulse` in MHEUShell.css).
- **Waveform gradient**: deliberate red→amber `#87150a → #eea91c`
  literal in `WaveformProgressBar.tsx` — kept because it's a brand
  signature, not driven by accent.

Files that set the "look":

| File | Role |
|---|---|
| `web/src/styles/tokens.css` | Color / radius / font tokens |
| `web/src/styles/global.css` | Reset, scrollbar, range-slider, body bg |
| `web/src/components/MHEUShell.css` | `.glass-card`, `.glass-card-subtle`, `.aero-button`, `.stat-card`, `.leaderboard-table`, `.connection-row`, `.section-header`, `.coming-soon-card`, `@keyframes prestigePulse` |
| `web/src/features/feed/feed.css` | Feed row chrome (uses tokens) |
| Inline styles in every component | Per-surface bespoke chrome |

## 5. Future themed surfaces (one file per theme)

Per the per-theme `components/` manifest. Each surface is a React
component that the rest of the app reaches via `useTheme().components.X`.

| Surface key | Where it currently lives | Notes |
|---|---|---|
| `DashboardShell` | `web/src/components/MHEUShell.tsx` | Wraps fog overlay + `<Outlet />` + nav. Theme controls fog look / no fog. |
| `NavBar` | inline in `MHEUShell.tsx` | Tab buttons + (NEW) profile icon top-left. |
| `ProfileDropdown` | NEW (PART 2) | Anchored panel below profile icon. |
| `ETabPlaceholder` | NEW (PART 2) | Replaces E-tab AccountPage content. |
| `HTabPlaceholder` | `tabs/HealthTab.tsx` | Coming-soon card. |
| `UTab` | `tabs/UserCompetitionTab.tsx` | Leaderboard + social feed. Big — kept as a single re-export for Frutiger Aero. |
| `MTab` | `tabs/MusicTab.tsx` (returns null) | Visualizer is mounted at App root, but the theme can take it over later. |
| `PlaybackControls` | `features/spotify/Controls.tsx` | Bottom-center transport. |
| `GearMenu` | `features/visualizer/GearMenu.tsx` | Side panel from gear icon. |
| `WaveformBar` | `features/spotify/WaveformProgressBar.tsx` | Top-of-M-tab progress envelope. |
| `SocialFeedRow` | `features/feed/FeedRow.tsx` | Per-row presentation. |

For Frutiger Aero, these will be either re-exports (NavBar's tab buttons
stay in this theme's component file but the profile icon is added) or
straight references to the existing modules (for big ones like
`UserCompetitionTab` and `GearMenu`). Stub themes provide `() => null`
stubs because their shell renders only "coming soon".

## 6. Migration impact

- `web/src/components/MHEUShell.tsx` becomes a thin consumer of
  `useTheme().components.DashboardShell`. Its current body moves into
  `web/src/themes/frutiger-aero/components/DashboardShell.tsx`.
- `web/src/App.tsx` wraps `<AppRoutes />` with `<ThemeProvider>` and an
  `<ActiveShell>` consumer.
- `web/src/components/tabs/EntertainmentTab.tsx` becomes a consumer of
  `useTheme().components.ETabPlaceholder`. The existing AccountPage is
  no longer rendered there — its controls move into ProfileDropdown.
  `AccountPage` itself is archived intact (`web/src/archive/e-tab-account-stuff/`).
- New table column: `public.profiles.theme_id text default 'frutiger-aero'`.
- New RLS policy: users can update `user_score_visibility` for their own
  rows (only `reveal_action` column).
