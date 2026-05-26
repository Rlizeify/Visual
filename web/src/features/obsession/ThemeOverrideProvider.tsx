// ThemeOverrideProvider — scope a specific theme to a route subtree.
//
// Forces `data-theme` on <html> to a chosen id for as long as this
// component is mounted. Restores the prior value on unmount.
//
// Does NOT write to profiles.theme_id — the user's preference is
// preserved cleanly. When they navigate out of the overridden
// subtree, the global ThemeContext re-applies their choice via its
// own effect on themeId.
//
// Why a separate provider instead of calling `setTheme()` from the
// global context: setTheme writes to Supabase fire-and-forget. We
// don't want a hidden feature mutating the user's persisted theme
// every time they visit. This component sidesteps the writeback by
// only touching the DOM attribute.

import { useEffect, type ReactNode } from 'react'

interface Props {
  /** Theme id to force, e.g. 'ac130-thermal'. */
  id: string
  children: ReactNode
}

export default function ThemeOverrideProvider({ id, children }: Props) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.documentElement.dataset.theme ?? ''
    document.documentElement.dataset.theme = id
    return () => {
      if (prev) document.documentElement.dataset.theme = prev
      else delete document.documentElement.dataset.theme
    }
  }, [id])

  return <>{children}</>
}
