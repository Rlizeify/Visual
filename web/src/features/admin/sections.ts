// Admin section registry.
//
// The admin console renders one tab per entry, in order. To add an admin
// feature: build its component, then add ONE entry here. No dashboard edits.
//
//   id           stable key (also the default-tab key)
//   label        tab text
//   component    lazy-loaded so admin code stays out of the main bundle
//   requiresRole 'admin'      = any profiles.is_admin user (route guard)
//                'superadmin' = also listed in VITE_SUPER_ADMIN_EMAILS
//
// Role checks here only hide UI. The matching /api/admin/* handler must
// still enforce access server-side with requireAdmin (api/_admin.ts).

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type AdminRole = 'admin' | 'superadmin'

interface AdminSection {
  id: string
  label: string
  component: LazyExoticComponent<ComponentType>
  requiresRole: AdminRole
}

const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: 'users',
    label: 'USERS',
    component: lazy(() => import('../../components/admin/UsersTab')),
    requiresRole: 'admin',
  },
  {
    id: 'passwords',
    label: 'PASSWORDS',
    component: lazy(() => import('../../components/admin/PasswordsTab')),
    requiresRole: 'admin',
  },
  {
    id: 'presets',
    label: 'PRESETS',
    component: lazy(() => import('../../components/admin/PresetsTab')),
    requiresRole: 'admin',
  },
]

const SUPER_ADMIN_EMAILS = (import.meta.env.VITE_SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

/** Sections the signed-in admin may see. Caller is already behind AdminProtectedRoute. */
export function sectionsFor(email: string | null | undefined): AdminSection[] {
  const isSuper = SUPER_ADMIN_EMAILS.includes((email ?? '').toLowerCase())
  return ADMIN_SECTIONS.filter(s => s.requiresRole === 'admin' || isSuper)
}
