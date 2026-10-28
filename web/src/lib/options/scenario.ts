// Scenario valuation: what is this option worth on a future date at a
// given SPX level, holding IV constant (plus an optional global shift)?

import { bsDelta, bsPrice, bsThetaPerDay, intrinsic, type OptionType } from './blackScholes.js'
import { daysBetween, yearFraction } from './dates.js'

export const CONTRACT_MULTIPLIER = 100

export interface PricedOption {
  type: OptionType
  strike: number
  /** `YYYY-MM-DD` */
  expiry: string
  /** Decimal vol (solved from premium, or the user's override). */
  iv: number
}

export interface MarketParams {
  /** Continuously-compounded rate for a given time to expiry in years. */
  rateFor: (years: number) => number
  divYield: number
}

export type ScenarioValue =
  | { status: 'ok'; value: number; atExpiry: boolean }
  | { status: 'expired' }

/**
 * Per-share option value on `scenarioDate` at `scenarioSpot`.
 *   - before expiry: Black-Scholes with iv + ivShift (vol points as decimal)
 *   - on the expiry date: intrinsic
 *   - after expiry: flagged 'expired', not computed
 */
export function valueAtScenario(
  option: PricedOption,
  scenarioDate: string,
  scenarioSpot: number,
  ivShift: number,
  market: MarketParams,
): ScenarioValue {
  const daysLeft = daysBetween(scenarioDate, option.expiry)
  if (daysLeft < 0) return { status: 'expired' }
  if (daysLeft === 0) {
    return { status: 'ok', value: intrinsic(option.type, scenarioSpot, option.strike), atExpiry: true }
  }
  const t = yearFraction(scenarioDate, option.expiry)
  const value = bsPrice({
    type: option.type,
    spot: scenarioSpot,
    strike: option.strike,
    t,
    rate: market.rateFor(t),
    divYield: market.divYield,
    vol: Math.max(0.001, option.iv + ivShift),
  })
  return { status: 'ok', value, atExpiry: false }
}

/** Delta and theta/day as of `asOfDate` at `spot`. */
export function greeksAt(option: PricedOption, asOfDate: string, spot: number, market: MarketParams) {
  const t = Math.max(0, yearFraction(asOfDate, option.expiry))
  const input = {
    type: option.type,
    spot,
    strike: option.strike,
    t,
    rate: market.rateFor(t),
    divYield: market.divYield,
    vol: option.iv,
  }
  return { delta: bsDelta(input), thetaPerDay: bsThetaPerDay(input) }
}

/** SPX level at expiry where the position breaks even (per-share premium). */
export function breakevenAtExpiry(type: OptionType, strike: number, premium: number): number {
  return type === 'call' ? strike + premium : strike - premium
}
