// Password policy — shared by signup, the admin force-set form and the
// admin API. Supabase Auth must be configured to match (Dashboard → Auth →
// Providers → Email: minimum length 12, "lowercase, uppercase, digits and
// symbols"), because a client can call Supabase's signup endpoint directly.

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

// Short list of the most-used passwords and patterns; the breach check
// below catches the long tail.
const COMMON = ['password', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon',
  'football', 'baseball', 'sunshine', 'princess', 'mheu', '123456', 'abc123', '111111']

/** Problems with `pw`, empty when it passes. `context` = email/username to keep out of it. */
export function passwordProblems(pw: string, context: Array<string | null | undefined> = []): string[] {
  const out: string[] = []
  if (pw.length < PASSWORD_MIN) out.push(`At least ${PASSWORD_MIN} characters`)
  if (pw.length > PASSWORD_MAX) out.push(`At most ${PASSWORD_MAX} characters`)
  if (!/[a-z]/.test(pw)) out.push('A lowercase letter')
  if (!/[A-Z]/.test(pw)) out.push('An uppercase letter')
  if (!/[0-9]/.test(pw)) out.push('A number')
  if (!/[^A-Za-z0-9]/.test(pw)) out.push('A symbol')
  const lower = pw.toLowerCase()
  if (COMMON.some(c => lower.includes(c))) out.push('No common words or sequences')
  if (/(.)\1{3,}/.test(pw)) out.push('No character repeated 4+ times in a row')
  const personal = context
    .flatMap(c => (c ?? '').toLowerCase().split('@'))
    .filter(c => c.length >= 3)
  if (personal.some(p => lower.includes(p))) out.push('Must not contain your email or username')
  return out
}

/**
 * True when the password appears in a known breach (Have I Been Pwned,
 * k-anonymity: only the first 5 hex chars of its SHA-1 leave this machine).
 * Fails open (false) if the service is unreachable.
 */
export async function isBreachedPassword(pw: string): Promise<boolean> {
  try {
    const buf = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw))
    const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return false
    const suffix = hex.slice(5)
    return (await res.text()).split('\n').some(line => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
