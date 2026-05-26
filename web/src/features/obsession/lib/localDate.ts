// Timezone-aware "today" helpers for Obsession.
//
// day_of_entry is stored as `date` (no timezone) and represents the
// calendar day the WRITE STARTED in the user's LOCAL timezone. This
// lets a user start a debrief at 11:55 pm local and have it counted
// against today, not tomorrow UTC.
//
// We never trust the browser clock for cross-user consistency, but
// for per-user daily limits the user's local clock is the right
// boundary.

/** YYYY-MM-DD in the browser's local timezone. */
export function todayLocalISODate(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Local ISO date for an arbitrary timestamp (ms or ISO string). */
export function localISODateOf(input: number | string | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  return todayLocalISODate(d)
}

/** Days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((db - da) / 86_400_000)
}

/** Format YYYY-MM-DD as e.g. "25 MAY 2026" for HUD readouts. */
export function formatHudDate(iso: string): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const [y, m, d] = iso.split('-')
  return `${d} ${months[Number(m) - 1]} ${y}`
}
