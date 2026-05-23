# 2026-05-23 — Theme system: sibling themes + shell/presentation split

## Context

The original MHEU UI was a single hardcoded look ("Frutiger Aero" —
glassy navy + per-user accent). Two new themes (Asian Vibrant, AC-130
Thermal) are scheduled. Without a contract, each new theme would have
needed scattered conditionals across every component and would have
made it impossible to ship one theme without breaking the others.

## Decision

A registry-based theme system with two clean separations:

1. **Sibling themes, not deviations from a baseline.** Frutiger Aero is
   one entry in the registry. Activating Asian Vibrant or AC-130 Thermal
   completely replaces the chrome — they aren't "Frutiger Aero with
   different colors". The registry treats them as equals.

2. **Shell / presentation split.** Every theme defines a `shell`
   (whole-app wrapper) and a `components` map (per-surface React
   components). Feature shells in the app (`MHEUShell.tsx`,
   `EntertainmentTab.tsx`, etc.) carry no presentation — they pull the
   active theme's surface via `useTheme().components.<Surface>` and
   render it.

Manifest shape (`web/src/themes/types.ts`):

```ts
ThemeManifest = {
  id, name, description,
  shell: ComponentType<{ children }>,
  components: ThemeSurfaces // 11 surfaces, expandable
}
```

11 initial surfaces: `DashboardShell`, `NavBar`, `ProfileDropdown`,
`MTab`, `HTabPlaceholder`, `ETabPlaceholder`, `UTab`,
`PlaybackControls`, `GearMenu`, `WaveformBar`, `SocialFeedRow`.

Persistence: `profiles.theme_id text default 'frutiger-aero'` with a
CHECK constraint on registered ids. ThemeContext writes back
fire-and-forget on change; local-storage caches the choice for
first-paint hydration.

Stub themes ship as part of this foundation: their `shell` renders a
centered "coming soon" plate that ignores `children` (so the
visualizer + routes do not mount), and every surface component is a
`NullStub`. They include a back-button to `setTheme('frutiger-aero')`
so users aren't stranded.

## Reasoning

- **Registry-based.** A `themes` map keyed by stable id is the
  smallest contract that supports persistence, switching, and listing.
- **Manifest-per-theme file.** Keeps theme code isolated; deleting a
  theme is one folder + two registry edits.
- **Sibling, not extension.** "Default + overrides" looked appealing
  but every override would have to grandfather the default's behavior —
  high coupling, low autonomy. Siblings can render literally anything.
- **Shell wrapping the whole app.** Lets stub themes intercept BEFORE
  the visualizer mounts, avoiding wasted GPU + audio capture.
- **Token contract via data-theme attribute.** `:root[data-theme='X']`
  selector outranks plain `:root` so per-theme tokens.css files
  override the fallback cleanly without specificity tricks.
- **NullStub + shell-takes-over for stubs.** Cheaper than implementing
  null-render variants of every component, and matches the user's
  spec: "selecting either of the stubs shows the 'coming soon'
  placeholder for that whole theme."
- **Same-day delivery without regression.** Frutiger Aero theme is
  built by re-exporting existing components (UTab, PlaybackControls,
  GearMenu, WaveformBar, SocialFeedRow) plus three new/extracted
  surfaces (NavBar with profile icon, DashboardShell, ProfileDropdown,
  E/H placeholders, MTab). No behavior change for current users.

## Alternatives considered

- **CSS-only theming.** Rejected — couldn't restructure the nav to
  inject a profile icon or replace the AC-130 brackets/scan-lines
  decoration with CSS alone.
- **Default + override map.** Rejected (see "Sibling, not extension"
  above).
- **Themes as full SPA bundles loaded dynamically.** Rejected — adds
  build-time complexity and breaks instant theme switching.

## Open follow-ups

- Theme-aware presentation for `Controls`, `GearMenu`, `WaveformBar`,
  `SocialFeedRow`, `UserCompetitionTab`. Currently re-exported by
  Frutiger Aero; once Asian Vibrant or AC-130 ships, each gets its
  own implementation under that theme's `components/`.
- Username edit + connected services list still archived under
  `web/src/archive/e-tab-account-stuff/`. Bring back into the profile
  dropdown or a future Settings surface when the entertainment tab
  ships.
- `ThemeProvider` reads `profiles.theme_id` once per auth-load; no
  realtime sync. If multi-device live switching becomes a thing, wire
  Supabase realtime to the profile row.
