// Route registry — the one list every page is declared in.
//
// The router, the nav, the landing-page tiles, auth gating and the
// document title are all generated from this array. To add a page:
//   1. Build it in its own folder: src/pages/<name>/ or src/features/<name>/
//      with a default-exported component.
//   2. Add ONE entry below.
//   3. (Optional) If access should be granted per user, add a key to
//      src/lib/features.ts and set `feature` below.
//   4. (Optional) If it needs admin tooling, add a section to
//      src/features/admin/sections.ts.
//
//   path          route path. Use `/x/*` for pages with nested routes.
//   title         nav label + document title.
//   description   landing-tile copy.
//   icon          key into app/icons.tsx.
//   requiresAuth  signed-out visitors go to /login?next=<path>.
//   requiresRole  'admin' = profiles.is_admin. UI gate only — the API
//                 still enforces with requireAdmin.
//   feature       key in lib/features.ts. Signed-in users without that
//                 grant don't see it in the nav and get "No access"; the
//                 feature's tables enforce the same via RLS has_feature().
//                 Guests still reach pages with requiresAuth: false.
//   songUnlock    listed in the nav only while the user's Spotify plays a
//                 song from public.fund_unlock_songs (app/songUnlock.ts).
//                 The page can be opened only then; once open it stays.
//                 Users without the grant are sent home, not told "No access".
//   hidden        never listed in nav or anywhere visible.
//   navOrder      nav position (lower first); null = not in nav.
//   chrome        'nav' = shared NavBar; 'none' = page owns the screen.
//   component     lazy so each page is its own chunk.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from './icons'
import type { FeatureKey } from '../lib/features'

export interface RouteEntry {
  path: string
  title: string
  description: string
  icon: IconName
  requiresAuth: boolean
  requiresRole?: 'admin'
  feature?: FeatureKey
  songUnlock?: boolean
  hidden: boolean
  navOrder: number | null
  chrome: 'nav' | 'none'
  component: LazyExoticComponent<ComponentType>
}

export const ROUTES: readonly RouteEntry[] = [
  {
    path: '/',
    title: 'Home',
    description: '',
    icon: 'home',
    requiresAuth: false,
    hidden: false,
    navOrder: null,
    chrome: 'nav',
    component: lazy(() => import('../pages/landing/LandingPage')),
  },
  {
    path: '/m',
    title: 'Visualizer',
    description: 'Milkdrop-style visuals driven by whatever you are playing. Share a tab or use the mic — nothing to install.',
    icon: 'wave',
    requiresAuth: true,
    feature: 'visualizer',
    hidden: false,
    navOrder: 1,
    chrome: 'nav',
    component: lazy(() => import('../pages/visualizer/VisualizerRoute')),
  },
  {
    path: '/investing',
    title: 'Investing',
    description: 'Compare SPX option candidates and drag through what-if profit at any level and date.',
    icon: 'chart',
    requiresAuth: false,
    feature: 'investing',
    hidden: false,
    navOrder: 2,
    chrome: 'nav',
    component: lazy(() => import('../features/investing/InvestingPage')),
  },
  {
    path: '/fund',
    title: 'Fund',
    description: '',
    icon: 'lock',
    requiresAuth: true,
    feature: 'fund',
    songUnlock: true,
    hidden: false,
    navOrder: 3,
    chrome: 'nav',
    component: lazy(() => import('../features/fund/FundPage')),
  },
  {
    path: '/admin',
    title: 'Admin',
    description: 'Users, passwords and visualizer presets.',
    icon: 'shield',
    requiresAuth: true,
    requiresRole: 'admin',
    hidden: false,
    navOrder: 9,
    chrome: 'nav',
    component: lazy(() => import('../pages/admin/AdminPage')),
  },
  {
    path: '/obsession/*',
    title: 'Obsession',
    description: '',
    icon: 'dot',
    requiresAuth: true,
    feature: 'obsession',
    hidden: true,
    navOrder: null,
    chrome: 'none',
    component: lazy(() => import('../features/obsession/ObsessionRoutes')),
  },
]

/** The entry that owns a pathname (prefix match for `/x/*`). */
export function routeFor(pathname: string): RouteEntry | undefined {
  return ROUTES.find(r => r.path.endsWith('/*')
    ? pathname === r.path.slice(0, -2) || pathname.startsWith(r.path.slice(0, -1))
    : pathname === r.path)
}

interface Viewer { signedIn: boolean; isAdmin: boolean; features: ReadonlySet<string>; songUnlocked?: boolean }

/** Signed-in viewer lacks the route's feature grant. */
export function lacksFeature(r: RouteEntry, v: Viewer): boolean {
  return !!r.feature && v.signedIn && !v.features.has(r.feature)
}

function canSee(r: RouteEntry, v: Viewer): boolean {
  if (r.hidden) return false
  if (r.songUnlock && !v.songUnlocked) return false
  if (r.requiresRole === 'admin') return v.isAdmin
  return !lacksFeature(r, v)
}

export function navRoutes(v: Viewer): RouteEntry[] {
  return ROUTES.filter(r => r.navOrder !== null && canSee(r, v))
    .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0))
}

/** `next` must be a same-origin path, never `//host`. */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
