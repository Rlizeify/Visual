// Date helpers for the options engine. All dates are ISO `YYYY-MM-DD`
// strings interpreted as calendar days (UTC midnight), so results do
// not shift with the viewer's timezone or DST.

const DAY_MS = 86_400_000

export const DAYS_PER_YEAR = 365

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toUtcDay(to) - toUtcDay(from)
}

/** Year fraction from `from` to `to`, calendar days / 365. */
export function yearFraction(from: string, to: string): number {
  return daysBetween(from, to) / DAYS_PER_YEAR
}

/** Today's date in the viewer's local timezone, as `YYYY-MM-DD`. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add whole months, clamping to the last day of the target month. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}
