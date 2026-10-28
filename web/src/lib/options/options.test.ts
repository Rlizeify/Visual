/**
 * Options engine tests.
 *
 * Run with: npm test (from web/)
 *
 * 1. normCdf against tabulated values
 * 2. Black-Scholes against published reference prices (Hull, Haug)
 * 3. Put-call parity with dividend yield
 * 4. Delta / theta against finite differences
 * 5. IV round-trip: price → IV → price within 1e-6
 * 6. IV solver error cases
 * 7. Intrinsic-at-expiry and expired-scenario edge cases
 * 8. Treasury curve parsing + interpolation
 */

import { describe, it, expect } from 'vitest'
import {
  normCdf,
  bsPrice,
  bsDelta,
  bsThetaPerDay,
  impliedVol,
  ImpliedVolError,
  type BSInput,
} from './blackScholes.js'
import { valueAtScenario, breakevenAtExpiry, type MarketParams } from './scenario.js'
import { tenorToYears, curvePoints, interpolateRate, bondEquivalentToContinuous } from './rates.js'
import { addMonths, daysBetween, yearFraction } from './dates.js'

describe('normCdf', () => {
  it('matches tabulated values', () => {
    expect(normCdf(0)).toBe(0.5)
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 13)
    expect(normCdf(-1.96)).toBeCloseTo(0.024997895148220435, 13)
    expect(normCdf(3)).toBeCloseTo(0.9986501019683699, 13)
    expect(normCdf(-8)).toBeCloseTo(6.22096057427178e-16, 20)
  })
})

describe('bsPrice reference values', () => {
  it('Hull Example 15.6: S=42 K=40 r=10% σ=20% T=0.5', () => {
    const base = { spot: 42, strike: 40, t: 0.5, rate: 0.1, divYield: 0, vol: 0.2 }
    expect(bsPrice({ ...base, type: 'call' })).toBeCloseTo(4.7594, 4)
    expect(bsPrice({ ...base, type: 'put' })).toBeCloseTo(0.8086, 4)
  })

  it('Haug (Merton 1973) put with dividend yield: S=100 K=95 T=0.5 r=10% q=5% σ=20%', () => {
    const p = bsPrice({ type: 'put', spot: 100, strike: 95, t: 0.5, rate: 0.1, divYield: 0.05, vol: 0.2 })
    expect(p).toBeCloseTo(2.4648, 4)
  })
})

describe('put-call parity', () => {
  it.each([
    [7700, 9500, 1.6, 0.045, 0.013, 0.18],
    [100, 80, 0.25, 0.02, 0.0, 0.5],
    [100, 120, 3, 0.05, 0.03, 0.9],
  ])('C - P = S e^-qT - K e^-rT  (S=%d K=%d T=%d)', (spot, strike, t, rate, divYield, vol) => {
    const base = { spot, strike, t, rate, divYield, vol }
    const c = bsPrice({ ...base, type: 'call' })
    const p = bsPrice({ ...base, type: 'put' })
    const rhs = spot * Math.exp(-divYield * t) - strike * Math.exp(-rate * t)
    expect(c - p).toBeCloseTo(rhs, 9)
  })
})

describe('greeks vs finite differences', () => {
  const base: BSInput = { type: 'call', spot: 7700, strike: 8000, t: 1.2, rate: 0.045, divYield: 0.013, vol: 0.17 }

  it.each(['call', 'put'] as const)('%s delta', type => {
    const i = { ...base, type }
    const h = 0.01
    const fd = (bsPrice({ ...i, spot: i.spot + h }) - bsPrice({ ...i, spot: i.spot - h })) / (2 * h)
    expect(bsDelta(i)).toBeCloseTo(fd, 6)
  })

  it.each(['call', 'put'] as const)('%s theta per day', type => {
    const i = { ...base, type }
    const h = 1e-5
    // theta = -dV/dT; per day = /365
    const fd = -(bsPrice({ ...i, t: i.t + h }) - bsPrice({ ...i, t: i.t - h })) / (2 * h) / 365
    expect(bsThetaPerDay(i)).toBeCloseTo(fd, 6)
  })
})

describe('impliedVol', () => {
  it.each([
    ['call', 7700, 9500, 1.63, 0.18],
    ['call', 7700, 7700, 0.1, 0.12],
    ['call', 7700, 6000, 2, 0.25],
    ['put', 7700, 7000, 0.5, 0.22],
    ['call', 100, 100, 0.02, 2.5],
    ['put', 100, 60, 1, 0.35],
  ] as const)('round-trips %s S=%d K=%d T=%d σ=%d', (type, spot, strike, t, vol) => {
    const inp = { type, spot, strike, t, rate: 0.045, divYield: 0.013 }
    const price = bsPrice({ ...inp, vol })
    const iv = impliedVol(price, inp)
    expect(Math.abs(bsPrice({ ...inp, vol: iv }) - price)).toBeLessThan(1e-6)
    expect(iv).toBeCloseTo(vol, 5)
  })

  const inp = { type: 'call' as const, spot: 100, strike: 80, t: 1, rate: 0.04, divYield: 0.01 }

  it('rejects a premium below intrinsic', () => {
    expect(() => impliedVol(19, inp)).toThrowError(/below intrinsic/)
    try { impliedVol(19, inp) } catch (e) {
      expect(e).toBeInstanceOf(ImpliedVolError)
      expect((e as ImpliedVolError).code).toBe('below-intrinsic')
    }
  })

  it('rejects a premium above the 300% vol price', () => {
    expect(() => impliedVol(99.9, inp)).toThrowError(ImpliedVolError)
  })

  it('rejects an option at expiry', () => {
    expect(() => impliedVol(5, { ...inp, t: 0 })).toThrowError(/expiry/)
  })

  it('rejects non-positive inputs', () => {
    expect(() => impliedVol(0, inp)).toThrowError(ImpliedVolError)
    expect(() => impliedVol(5, { ...inp, spot: 0 })).toThrowError(ImpliedVolError)
  })
})

describe('valueAtScenario', () => {
  const market: MarketParams = { rateFor: () => 0.045, divYield: 0.013 }
  const call = { type: 'call' as const, strike: 9500, expiry: '2028-06-15', iv: 0.18 }
  const put = { type: 'put' as const, strike: 7000, expiry: '2028-06-15', iv: 0.2 }

  it('returns intrinsic on the expiry date', () => {
    expect(valueAtScenario(call, '2028-06-15', 10000, 0, market)).toEqual({ status: 'ok', value: 500, atExpiry: true })
    expect(valueAtScenario(call, '2028-06-15', 9000, 0, market)).toEqual({ status: 'ok', value: 0, atExpiry: true })
    expect(valueAtScenario(put, '2028-06-15', 6500, 0, market)).toEqual({ status: 'ok', value: 500, atExpiry: true })
    expect(valueAtScenario(put, '2028-06-15', 7500, 0, market)).toEqual({ status: 'ok', value: 0, atExpiry: true })
  })

  it('flags dates after expiry instead of computing', () => {
    expect(valueAtScenario(call, '2028-06-16', 10000, 0, market)).toEqual({ status: 'expired' })
  })

  it('matches bsPrice before expiry and applies the IV shift', () => {
    const t = yearFraction('2027-04-28', '2028-06-15')
    const expected = bsPrice({ type: 'call', spot: 8500, strike: 9500, t, rate: 0.045, divYield: 0.013, vol: 0.23 })
    const v = valueAtScenario(call, '2027-04-28', 8500, 0.05, market)
    expect(v.status).toBe('ok')
    if (v.status === 'ok') expect(v.value).toBeCloseTo(expected, 9)
  })

  it('value rises with spot and decays toward expiry at a fixed level', () => {
    const levels = [7000, 8000, 9000, 10000, 11000]
    const byLevel = levels.map(s => {
      const v = valueAtScenario(call, '2027-06-15', s, 0, market)
      return v.status === 'ok' ? v.value : NaN
    })
    for (let k = 1; k < byLevel.length; k++) expect(byLevel[k]).toBeGreaterThan(byLevel[k - 1])

    const dates = ['2026-10-28', '2027-04-28', '2027-10-28', '2028-03-15', '2028-06-14']
    const byDate = dates.map(d => {
      const v = valueAtScenario(call, d, 9000, 0, market)
      return v.status === 'ok' ? v.value : NaN
    })
    for (let k = 1; k < byDate.length; k++) expect(byDate[k]).toBeLessThan(byDate[k - 1])
  })

  it('breakeven at expiry', () => {
    expect(breakevenAtExpiry('call', 9500, 120)).toBe(9620)
    expect(breakevenAtExpiry('put', 7000, 80)).toBe(6920)
  })
})

describe('rates', () => {
  it('parses Treasury tenor labels', () => {
    expect(tenorToYears('1 Mo')).toBeCloseTo(1 / 12, 12)
    expect(tenorToYears('1.5 Month')).toBeCloseTo(0.125, 12)
    expect(tenorToYears('10 Yr')).toBe(10)
    expect(tenorToYears('Date')).toBeNull()
  })

  it('interpolates linearly and extrapolates flat', () => {
    const pts = curvePoints({ '1 Yr': 4.0, '2 Yr': 5.0, '6 Mo': 3.0 })
    expect(pts.map(p => p.years)).toEqual([0.5, 1, 2])
    const r1 = bondEquivalentToContinuous(4.0)
    const r2 = bondEquivalentToContinuous(5.0)
    expect(interpolateRate(pts, 1.5)).toBeCloseTo((r1 + r2) / 2, 12)
    expect(interpolateRate(pts, 0.1)).toBeCloseTo(bondEquivalentToContinuous(3.0), 12)
    expect(interpolateRate(pts, 30)).toBeCloseTo(r2, 12)
    expect(interpolateRate([], 1)).toBeNull()
  })
})

describe('dates', () => {
  it('counts calendar days across DST and leap years', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(yearFraction('2026-01-01', '2027-01-01')).toBe(1)
  })

  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-10-28', 6)).toBe('2027-04-28')
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonths('2026-10-28', 12)).toBe('2027-10-28')
  })
})
