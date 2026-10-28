import type { CandidateRow } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2028-06-15` → `Jun 15 '28` */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d} '${String(y).slice(2)}`
}

export function candidateName(c: Pick<CandidateRow, 'label' | 'strike' | 'type' | 'expiry'>): string {
  if (c.label) return c.label
  const [y, m] = c.expiry.split('-').map(Number)
  return `${c.strike}${c.type === 'call' ? 'C' : 'P'} ${MONTHS[m - 1]}${String(y).slice(2)}`
}

export function money(v: number, digits = 0): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${v < 0 ? '−' : ''}$${s}`
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`
}

export function level(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Parse a user-typed number; tolerates commas and `$`. NaN if empty/invalid. */
export function parseNum(s: string): number {
  const t = s.replace(/[$,\s]/g, '')
  return t === '' ? NaN : Number(t)
}
