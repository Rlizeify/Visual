const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function money(v: number, digits = 2): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${v < 0 ? '−' : ''}$${s}`
}

/** Signed money: +$1,234 / −$1,234. */
export function signedMoney(v: number, digits = 2): string {
  return `${v > 0 ? '+' : ''}${money(v, digits)}`
}

export function pct(v: number, digits = 2): string {
  return `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(digits)}%`
}

export function signedPct(v: number, digits = 2): string {
  return `${v > 0 ? '+' : ''}${pct(v, digits)}`
}

/** `2026-09-30` → `Sep 30, 2026` */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** `2026-09-30` → `Sep '26` */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`
}

/** Last day of the month `n` months after the month of `iso`. */
export function monthEndAfter(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n + 1, 0))
  return d.toISOString().slice(0, 10)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a typed number; tolerates commas, `$`, `%`. NaN if empty/invalid. */
export function parseNum(s: string): number {
  const t = s.replace(/[$,%\s]/g, '').replace(/^−/, '-')
  return t === '' ? NaN : Number(t)
}
