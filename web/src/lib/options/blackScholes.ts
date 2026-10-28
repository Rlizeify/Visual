// European Black-Scholes with continuous dividend yield.
//
// Pure math — no React, no Supabase. Imported by the /investing page
// and (for types) by the market-snapshot handler.
//
// Conventions:
//   - rates and dividend yield are continuously-compounded decimals
//     (0.042 = 4.2%)
//   - vol is a decimal (0.18 = 18 vol points)
//   - t is in years (calendar days / 365, see dates.ts)
//   - theta is reported per calendar day (annual theta / 365)

export type OptionType = 'call' | 'put'

export interface BSInput {
  type: OptionType
  spot: number
  strike: number
  /** Years to expiry. <= 0 means at/after expiry → intrinsic. */
  t: number
  /** Continuously-compounded risk-free rate. */
  rate: number
  /** Continuously-compounded dividend yield. */
  divYield: number
  vol: number
}

export const IV_MIN = 0.01
export const IV_MAX = 3.0

/** Standard normal density. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * Standard normal CDF. Hart (1968) double-precision algorithm as given
 * by West, "Better approximations to cumulative normal functions"
 * (2005). Accurate to ~1e-14 across the real line.
 */
export function normCdf(x: number): number {
  const a = Math.abs(x)
  let c: number
  if (a > 37) {
    c = 0
  } else {
    const e = Math.exp(-a * a / 2)
    if (a < 7.07106781186547) {
      let n = 3.52624965998911e-2 * a + 0.700383064443688
      n = n * a + 6.37396220353165
      n = n * a + 33.912866078383
      n = n * a + 112.079291497871
      n = n * a + 221.213596169931
      n = n * a + 220.206867912376
      let d = 8.83883476483184e-2 * a + 1.75566716318264
      d = d * a + 16.064177579207
      d = d * a + 86.7807322029461
      d = d * a + 296.564248779674
      d = d * a + 637.333633378831
      d = d * a + 793.826512519948
      d = d * a + 440.413735824752
      c = e * n / d
    } else {
      let b = a + 0.65
      b = a + 4 / b
      b = a + 3 / b
      b = a + 2 / b
      b = a + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return x > 0 ? 1 - c : c
}

export function intrinsic(type: OptionType, spot: number, strike: number): number {
  return type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot)
}

function d1d2(i: BSInput): { d1: number; d2: number; sqrtT: number } {
  const sqrtT = Math.sqrt(i.t)
  const vs = i.vol * sqrtT
  const d1 = (Math.log(i.spot / i.strike) + (i.rate - i.divYield + 0.5 * i.vol * i.vol) * i.t) / vs
  return { d1, d2: d1 - vs, sqrtT }
}

function atExpiry(i: BSInput): boolean {
  return i.t <= 0 || i.vol <= 0
}

export function bsPrice(i: BSInput): number {
  if (atExpiry(i)) return intrinsic(i.type, i.spot, i.strike)
  const { d1, d2 } = d1d2(i)
  const dfq = Math.exp(-i.divYield * i.t)
  const dfr = Math.exp(-i.rate * i.t)
  if (i.type === 'call') {
    return i.spot * dfq * normCdf(d1) - i.strike * dfr * normCdf(d2)
  }
  return i.strike * dfr * normCdf(-d2) - i.spot * dfq * normCdf(-d1)
}

export function bsDelta(i: BSInput): number {
  if (atExpiry(i)) {
    if (i.type === 'call') return i.spot > i.strike ? 1 : 0
    return i.spot < i.strike ? -1 : 0
  }
  const { d1 } = d1d2(i)
  const dfq = Math.exp(-i.divYield * i.t)
  return i.type === 'call' ? dfq * normCdf(d1) : dfq * (normCdf(d1) - 1)
}

/** Vega per 1.00 of vol (not per vol point). Same for calls and puts. */
export function bsVega(i: BSInput): number {
  if (atExpiry(i)) return 0
  const { d1, sqrtT } = d1d2(i)
  return i.spot * Math.exp(-i.divYield * i.t) * normPdf(d1) * sqrtT
}

/** Theta per calendar day (negative = option loses value as time passes). */
export function bsThetaPerDay(i: BSInput): number {
  if (atExpiry(i)) return 0
  const { d1, d2, sqrtT } = d1d2(i)
  const dfq = Math.exp(-i.divYield * i.t)
  const dfr = Math.exp(-i.rate * i.t)
  const decay = -(i.spot * dfq * normPdf(d1) * i.vol) / (2 * sqrtT)
  const annual = i.type === 'call'
    ? decay - i.rate * i.strike * dfr * normCdf(d2) + i.divYield * i.spot * dfq * normCdf(d1)
    : decay + i.rate * i.strike * dfr * normCdf(-d2) - i.divYield * i.spot * dfq * normCdf(-d1)
  return annual / 365
}

export type IVErrorCode = 'expired' | 'below-intrinsic' | 'below-min-vol' | 'above-max-vol' | 'no-convergence' | 'bad-input'

export class ImpliedVolError extends Error {
  constructor(public code: IVErrorCode, message: string) {
    super(message)
    this.name = 'ImpliedVolError'
  }
}

/**
 * Solve for the vol that reproduces `premium` (per share, not per
 * contract). Newton on vega, falling back to bisection whenever a
 * Newton step leaves the current bracket. Bounded to [IV_MIN, IV_MAX].
 *
 * Throws ImpliedVolError when the premium is outside what any vol in
 * the bounds can produce — most commonly a premium below intrinsic.
 */
export function impliedVol(premium: number, i: Omit<BSInput, 'vol'>): number {
  if (!(premium > 0) || !(i.spot > 0) || !(i.strike > 0) || !Number.isFinite(i.t)) {
    throw new ImpliedVolError('bad-input', 'Premium, spot and strike must be positive numbers.')
  }
  if (i.t <= 0) {
    throw new ImpliedVolError('expired', 'Option is at or past expiry — no time value to solve for.')
  }
  const price = (vol: number) => bsPrice({ ...i, vol })
  const pLo = price(IV_MIN)
  const pHi = price(IV_MAX)
  const intr = intrinsic(i.type, i.spot, i.strike)

  if (premium < pLo) {
    if (premium < intr) {
      throw new ImpliedVolError(
        'below-intrinsic',
        `Premium ${premium.toFixed(2)} is below intrinsic value ${intr.toFixed(2)}.`,
      )
    }
    throw new ImpliedVolError(
      'below-min-vol',
      `Premium ${premium.toFixed(2)} is below the model price at ${IV_MIN * 100}% vol (${pLo.toFixed(2)}).`,
    )
  }
  if (premium > pHi) {
    throw new ImpliedVolError(
      'above-max-vol',
      `Premium ${premium.toFixed(2)} is above the model price at ${IV_MAX * 100}% vol (${pHi.toFixed(2)}).`,
    )
  }

  let lo = IV_MIN
  let hi = IV_MAX
  // Brenner-Subrahmanyam ATM guess, clamped into the bracket.
  let vol = Math.min(hi, Math.max(lo, Math.sqrt(2 * Math.PI / i.t) * premium / i.spot))
  const tol = 1e-10 * Math.max(1, premium)

  for (let iter = 0; iter < 200; iter++) {
    const diff = price(vol) - premium
    if (Math.abs(diff) < tol) return vol
    if (diff > 0) hi = vol
    else lo = vol
    if (hi - lo < 1e-14) return vol

    const vega = bsVega({ ...i, vol })
    const newton = vega > 1e-12 ? vol - diff / vega : NaN
    vol = newton > lo && newton < hi ? newton : 0.5 * (lo + hi)
  }
  throw new ImpliedVolError('no-convergence', 'Implied vol solver did not converge.')
}
