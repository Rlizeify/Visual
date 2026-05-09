import { supabase } from './supabase'

// Browser-side helper for the /api/admin/* edge functions. Attaches the
// Supabase JWT so the server can verify the caller's is_admin claim.
//
// Throws on non-2xx with the server's error message, so calling code can
// `try { await adminApi(...) } catch (e) { setError(e.message) }`.

export async function adminApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('not authenticated')

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, { ...init, headers })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).error)
        : `request failed (${res.status})`
    throw new Error(msg)
  }

  return body as T
}

export const adminGet = <T = unknown>(path: string) => adminApi<T>(path, { method: 'GET' })

export const adminPost = <T = unknown>(path: string, body: unknown) =>
  adminApi<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const adminPatch = <T = unknown>(path: string, body: unknown) =>
  adminApi<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const adminPut = <T = unknown>(path: string, body: unknown) =>
  adminApi<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export const adminDelete = <T = unknown>(path: string) =>
  adminApi<T>(path, { method: 'DELETE' })
