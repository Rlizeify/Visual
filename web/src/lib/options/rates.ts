// Risk-free rate from the US Treasury par yield curve.
//
// The snapshot stores the curve as published: tenor label → yield in
// percent, bond-equivalent (semiannual) basis. The engine wants a
// continuously-compounded decimal at an arbitrary time to expiry, so
// we convert each point and linearly interpolate between tenors
// (flat extrapolation beyond the ends).

/** Tenor label → par yield in percent, e.g. { "1 Mo": 4.10, "2 Yr": 4.70 }. */
export type TreasuryCurve = Record<string, number>

export interface CurvePoint {
  years: number
  /** Continuously-compounded decimal. */
  rate: number
}

/** Parse a Treasury column label ("1 Mo", "1.5 Month", "6 Mo", "10 Yr") into years. */
export function tenorToYears(label: string): number | null {
  const m = label.trim().match(/^([\d.]+)\s*(mo|month|months|yr|year|years)$/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return /^y/i.test(m[2]) ? n : n / 12
}

/** Semiannual bond-equivalent percent → continuous decimal. */
export function bondEquivalentToContinuous(pct: number): number {
  return 2 * Math.log(1 + pct / 100 / 2)
}

export function curvePoints(curve: TreasuryCurve | null | undefined): CurvePoint[] {
  if (!curve) return []
  const pts: CurvePoint[] = []
  for (const [label, pct] of Object.entries(curve)) {
    const years = tenorToYears(label)
    if (years === null || typeof pct !== 'number' || !Number.isFinite(pct)) continue
    pts.push({ years, rate: bondEquivalentToContinuous(pct) })
  }
  return pts.sort((a, b) => a.years - b.years)
}

/** Linear interpolation on the curve; flat beyond the first/last tenor. */
export function interpolateRate(points: CurvePoint[], years: number): number | null {
  if (points.length === 0) return null
  if (years <= points[0].years) return points[0].rate
  const last = points[points.length - 1]
  if (years >= last.years) return last.rate
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    if (years <= b.years) {
      const w = (years - a.years) / (b.years - a.years)
      return a.rate + w * (b.rate - a.rate)
    }
  }
  return last.rate
}
