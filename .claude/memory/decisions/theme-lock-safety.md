# Theme Lock-Safety — Decision

**Date**: 2026-05-24
**Status**: Adopted

## Context

The theme system (registry + `useTheme()` + per-theme manifests) makes
all chrome plug-in. The active theme persists in `profiles.theme_id`,
which means a theme that throws during render can lock the user out
of the app the next time they sign in: every retry re-hydrates the
same broken theme, and the profile-dropdown UI (the only in-app place
to switch themes) lives inside the broken theme. The only escape
hatch was a direct SQL update against `profiles.theme_id`, which is
unacceptable for non-admin users and slow for admins.

This was observed in production on 2026-05-24 with Stone stuck on
Asian Vibrant — admin panel still worked (it bypasses MHEU theme
components), but `/m`, `/h`, `/e`, `/u` would not get past the splash.

## Decision

Theme rendering is wrapped in a `ThemeErrorBoundary` at the
`ThemeProvider` level (`web/src/themes/ThemeContext.tsx`). On any
throw:

1. The boundary calls `onThemeError(themeId, error, info)`.
2. The provider adds the failing theme id to a session-local
   `blockedThemes` Set.
3. The provider sets active theme to `DEFAULT_THEME_ID`
   (Frutiger Aero) **for the session only** — it does NOT write to
   `profiles.theme_id`. The user's preference is preserved so they
   keep it once the bug is fixed.
4. A `resetCounter` bumps so the boundary remounts clean once the
   default theme replaces the broken one.
5. The auth-load hydration effect skips any theme id in
   `blockedThemes`, preventing the fall-back from being undone by
   the next profile fetch.

## Reasoning

- **Lock-safe by default**: a buggy theme cannot lock the entire app
  ever again. This is non-negotiable for future themes
  (AC-130 Thermal, anything user-contributed).
- **Preserves user intent**: not writing to `profiles.theme_id` means
  the user does not lose their choice. After a fix ships, the next
  session restores the preferred theme.
- **Single observation point**: the only place a theme can break the
  app is through its rendered components, so one boundary at the
  provider level covers every surface — `shell`, `DashboardShell`,
  `NavBar`, `ProfileDropdown`, `MTab`, `HTab`, `ETab`, `UTab`,
  `PlaybackControls`, `GearMenu`, `WaveformBar`, `SocialFeedRow`,
  and `Decorations`.
- **Cheap to maintain**: ~80 lines of React, no per-theme glue. Any
  new theme inherits the protection automatically.

## Hard rules going forward

1. **Never remove the `ThemeErrorBoundary` from `ThemeProvider`.**
2. **Never write to `profiles.theme_id` from the error fallback path.**
   The fallback is a session-only safety net, not a persistence event.
3. **Stub themes must include a path back out** (see
   `patterns/theme-system.md` — they render a back button that calls
   `setTheme(DEFAULT_THEME_ID)`). The boundary protects against the
   stub itself throwing, but the back button is the intended UX.
4. **New themes don't need their own boundary.** The registry-level
   one covers everything below it.
5. **Console error contains the theme id.** Format:
   `[theme] '<id>' threw during render — falling back to default for
   this session.` This is the breadcrumb that turns a "site is
   broken" report into a one-grep debugging session.

## Admin escape hatch (still valid)

If a theme breaks before the boundary mounts (constructor-time module
load failure, missing CSS that prevents body paint), the SQL
fallback remains:

```sql
UPDATE profiles SET theme_id = 'frutiger-aero' WHERE id = '<user-uuid>';
```

This should be increasingly rare given the boundary catches all
render-time failures.

## Related

- `web/src/themes/ThemeErrorBoundary.tsx` — the boundary itself.
- `web/src/themes/ThemeContext.tsx` — provider wiring + fallback
  logic + `blockedThemes` Set.
- `patterns/theme-system.md` — overall theme contract.
- `decisions/theme-system-architecture.md` — original architecture
  decision this builds on.
