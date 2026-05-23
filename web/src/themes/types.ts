import type { ComponentType, ReactNode } from 'react'

/**
 * Theme system contract.
 *
 * A theme is a set of presentation choices that wrap the same underlying
 * feature shells. The shell defines structure / behavior / data; the
 * theme defines color / texture / font / decorative chrome / animation.
 * Themes are siblings — none is "the default" or "the baseline".
 *
 * To add a new theme:
 *   1. Create web/src/themes/<id>/ with tokens.css, shell.tsx, components/
 *   2. Implement every surface in ThemeSurfaces (or return null for the
 *      ones the theme intentionally hides — e.g. stub themes).
 *   3. Default-export a ThemeManifest from web/src/themes/<id>/index.ts.
 *   4. Register it in web/src/themes/registry.ts.
 *   5. Browse it via the theme switcher in the profile dropdown.
 *
 * Surface props are intentionally loose for now (any) — they get tightened
 * when each surface is actually wired to the theme via useTheme().
 */

export interface ThemeShellProps {
  children: ReactNode
}

export interface ThemeSurfaces {
  /** Whole-route shell. Wraps nav + outlet + any per-theme overlays. */
  DashboardShell: ComponentType
  /** Top nav bar (tab buttons + profile icon). */
  NavBar: ComponentType
  /** Anchored dropdown under the profile icon. */
  ProfileDropdown: ComponentType<{ open: boolean; onClose: () => void; anchorRect: DOMRect | null }>
  /** M tab body — visualizer is mounted at App root, but theme may override. */
  MTab: ComponentType
  /** H tab placeholder. */
  HTabPlaceholder: ComponentType
  /** E tab placeholder. */
  ETabPlaceholder: ComponentType
  /** U tab body — leaderboard + social feed. */
  UTab: ComponentType
  /** Bottom-center transport for the visualizer. */
  PlaybackControls: ComponentType<{ isPlaying: boolean; shuffleState: boolean; visible: boolean }>
  /** Gear menu side panel. Props match VisualizerEngine's GearMenu. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GearMenu: ComponentType<any>
  /** Top-of-M-tab waveform progress bar. */
  WaveformBar: ComponentType
  /** Per-row social-feed presentation. Props match FeedRow. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SocialFeedRow: ComponentType<any>
}

export interface ThemeManifest {
  /** URL-safe stable id stored in profiles.theme_id. */
  id: string
  /** Human-readable name shown in the theme switcher. */
  name: string
  /** One-line aesthetic pitch shown in the theme switcher. */
  description: string
  /**
   * Whole-app wrapper. Frutiger Aero passes through; stub themes
   * render a "coming soon" screen and may ignore children entirely.
   */
  shell: ComponentType<ThemeShellProps>
  /** Per-surface presentation components. */
  components: ThemeSurfaces
}
