// Every registry route (+ /login, /signup, Obsession) at 9 widths,
// signed out and signed in. Asserts:
//   1. no horizontal page overflow (scrollWidth ≤ innerWidth)
//   2. no visible interactive element sticks out past the left/right
//      edge (elements inside a horizontal scroller are exempt — that's
//      the sanctioned table pattern)
// Screenshots: ../audit-screenshots/final/ (gitignored).
//
// Signed-in runs create a temporary password user with the service-role
// admin API, grant admin for the run, and delete the user (cascading its
// rows) at the end. Credentials come only from the environment.

import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { ROUTES } from '../src/app/routes'
import { createTestUser, deleteTestUser, serviceEnv, type TestUser } from './testUser'

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]
const SHOT_DIR = '../audit-screenshots/final'
mkdirSync(SHOT_DIR, { recursive: true })

const pathsFromRegistry = ROUTES.map(r => (r.path.endsWith('/*') ? r.path.slice(0, -2) : r.path))
const SIGNED_OUT = Array.from(new Set([...pathsFromRegistry, '/login', '/signup']))
const SIGNED_IN = Array.from(new Set([...pathsFromRegistry, '/obsession/training', '/obsession/settings', '/spotify-login']))

async function audit(page: Page) {
  return page.evaluate(() => {
    const iw = window.innerWidth
    const scrollW = document.documentElement.scrollWidth
    const clipped: string[] = []
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX
        if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true
      }
      return false
    }
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="tab"], [role="radio"]')) {
      if (el.closest('.skip-link, .sr-only, [inert], [aria-hidden="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      if (inScroller(el)) continue
      if (r.left < -1 || r.right > iw + 1) {
        clipped.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" [${Math.round(r.left)}, ${Math.round(r.right)}]`)
      }
    }
    return { iw, scrollW, clipped }
  })
}

async function checkAll(page: Page, paths: string[], tag: string) {
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
    for (const path of paths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(250)
      const { iw, scrollW, clipped } = await audit(page)
      const name = `${tag}_${path.replace(/\//g, '_') || '_root'}_${width}`.replace(/_+/g, '_')
      await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true })
      if (scrollW > iw) failures.push(`${tag} ${path} @${width}: page overflows (${scrollW} > ${iw})`)
      for (const c of clipped) failures.push(`${tag} ${path} @${width}: clipped ${c}`)
    }
  }
  expect(failures, failures.join('\n')).toEqual([])
}

test('signed out: no overflow, nothing clipped', async ({ page }) => {
  await checkAll(page, SIGNED_OUT, 'out')
})

test.describe('signed in', () => {
  let user: TestUser | null = null

  test.beforeAll(async () => {
    if (serviceEnv()) user = await createTestUser({ admin: true })
  })
  test.afterAll(async () => {
    if (user) await deleteTestUser(user)
  })

  test('no overflow, nothing clipped', async ({ page }) => {
    test.skip(!serviceEnv(), 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run signed-in checks.')
    await page.goto('/login')
    await page.getByLabel('Email or username').fill(user!.email)
    await page.getByLabel('Password').fill(user!.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await page.waitForURL(url => !url.pathname.startsWith('/login'))
    await checkAll(page, SIGNED_IN, 'in')
  })
})
