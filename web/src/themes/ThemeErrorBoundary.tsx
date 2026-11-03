import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * ThemeErrorBoundary — catches any throw from a theme shell or surface
 * and falls back to the default theme for the rest of the session.
 *
 * Why this exists: a single buggy theme component (Asian Vibrant
 * Decorations, Frutiger Aero NavBar, anyone) was previously able to
 * lock the entire app — once `profiles.theme_id` pointed at a broken
 * theme, the user could not reach the profile dropdown to switch
 * back out, because the dropdown lives inside the broken theme.
 *
 * Recovery is session-only (does NOT write to profiles.theme_id), so
 * the user can fix the underlying bug and have their preference
 * restored. An admin SQL fallback is the durable escape hatch:
 *
 *   UPDATE profiles SET theme_id = 'frutiger-aero' WHERE id = '<uuid>';
 *
 * Pair this with the registry-level `onThemeError` callback that is
 * passed in by ThemeProvider — it flips the in-memory `themeId` back
 * to DEFAULT_THEME_ID so the next render uses safe components.
 */

interface Props {
  children: ReactNode
  /** Called once when a render throws. Passes the failing theme id. */
  onThemeError: (themeId: string, error: Error, info: ErrorInfo) => void
  /** Active theme id at the moment of mount — passed to onThemeError. */
  themeId: string
  /** Forces a remount when changed — used to clear the error state once
   *  the parent has swapped to a safe theme. */
  resetKey: string
}

interface State {
  hasError: boolean
}

export default class ThemeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console with enough breadcrumb to debug from a
    // user-reported "site is broken" report.
    console.error(
      `[theme] '${this.props.themeId}' threw during render — falling back to default for this session.`,
      error,
      info.componentStack,
    )
    try {
      this.props.onThemeError(this.props.themeId, error, info)
    } catch (cbErr) {
      console.error('[theme] onThemeError callback itself threw:', cbErr)
    }
  }

  render() {
    if (this.state.hasError) {
      // Render nothing — the parent will swap to the default theme and
      // remount with a new resetKey, clearing the error.
      return null
    }
    return this.props.children
  }
}
