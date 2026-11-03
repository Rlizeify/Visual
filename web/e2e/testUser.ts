// Temporary test user for signed-in e2e runs. Service-role key comes
// from the environment only; nothing here is ever committed with values.

import { randomBytes } from 'node:crypto'

export interface TestUser { id: string; email: string; password: string }

export function serviceEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

async function call(path: string, init: RequestInit) {
  const env = serviceEnv()!
  const res = await fetch(`${env.url}${path}`, {
    ...init,
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json().catch(() => null)
}

export async function createTestUser(opts: { admin: boolean }): Promise<TestUser> {
  const tag = randomBytes(4).toString('hex')
  const email = `e2e-${tag}@example.test`
  const password = randomBytes(18).toString('base64url')
  const created = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username: `e2e_${tag}` } }),
  })
  const id = created.id as string
  // The signup trigger normally creates the profile; upsert in case it didn't.
  await call('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, username: `e2e_${tag}`, is_admin: opts.admin }),
  })
  return { id, email, password }
}

/** Deleting the auth user cascades to profiles and every per-user table. */
export async function deleteTestUser(u: TestUser): Promise<void> {
  await call(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
}
