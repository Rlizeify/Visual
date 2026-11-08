// 3D views (WebGL, jet colormap):
//   Likelihood  months ahead × balance → how likely each balance is that
//               month (each month's peak = 1). The ridge is the most likely
//               path; the way it flattens and widens is the uncertainty.
//   Outcomes    months ahead × expected monthly return → median balance.
//               Slice across to see what a better or worse rate is worth.

import { useMemo, useState } from 'react'
import Plot from '../charts/Plot'
import { chartTheme, jetScale } from '../charts/theme'
import { likelihoodSurface, outcomeSurface, type Projection, type ProjectionInput } from '../lib/projection'

type View = 'likelihood' | 'outcomes'

export default function Surface3D({ input, proj, lastDate }: { input: ProjectionInput; proj: Projection; lastDate: string }) {
  const [view, setView] = useState<View>('likelihood')
  const [on, setOn] = useState(true)

  const { data, layout } = useMemo(() => {
    if (!on) return { data: [], layout: {} }
    const c = chartTheme()
    const axis = (title: string, extra: Record<string, unknown> = {}) => ({
      title: { text: title, font: { color: c.text } }, gridcolor: c.grid, zerolinecolor: c.line,
      backgroundcolor: 'transparent', showbackground: false, tickfont: { color: c.muted }, color: c.muted, ...extra,
    })
    const s = view === 'likelihood' ? likelihoodSurface(proj, input) : outcomeSurface(input)
    const surface = {
      type: 'surface', x: s.x, y: s.y, z: s.z, colorscale: jetScale(), showscale: false,
      contours: { z: { show: true, usecolormap: true, project: { z: true }, width: 1 } },
      lighting: { ambient: 0.75, diffuse: 0.6, specular: 0.15, roughness: 0.6 },
      hovertemplate: view === 'likelihood'
        ? 'Month %{x}<br>$%{y:,.0f}<br>Likelihood %{z:.2f}<extra></extra>'
        : 'Month %{x}<br>%{y:.1%} / mo<br>Median $%{z:,.0f}<extra></extra>',
    }
    return {
      data: [surface],
      layout: {
        paper_bgcolor: 'transparent',
        font: { family: c.font, color: c.text, size: 11 },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        scene: {
          xaxis: axis('Months ahead'),
          yaxis: view === 'likelihood' ? axis('Balance', { tickprefix: '$', tickformat: ',.3s' }) : axis('Monthly return', { tickformat: '.0%' }),
          zaxis: view === 'likelihood' ? axis('Likelihood') : axis('Median balance', { tickprefix: '$', tickformat: ',.3s' }),
          camera: { eye: { x: -1.6, y: -1.5, z: 0.9 } },
          aspectmode: 'manual', aspectratio: { x: 1.4, y: 1, z: 0.7 },
        },
      },
    }
  }, [on, view, proj, input])

  return (
    <section className="stack" aria-labelledby="fund-3d">
      <div className="row fund-chart-head">
        <h3 id="fund-3d">3D</h3>
        <div className="fund-seg fund-seg--sm" role="radiogroup" aria-label="3D view">
          {(['likelihood', 'outcomes'] as const).map(v => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'on' : ''}
              onClick={() => { setView(v); setOn(true) }}>{v === 'likelihood' ? 'Likelihood' : 'Outcomes by return'}</button>
          ))}
        </div>
      </div>
      <p className="muted">
        {view === 'likelihood'
          ? 'Every month ahead, how likely each balance is (each month scaled so its most likely balance = 1). The red crest is the most likely path; the wider it gets, the less certain that month is. Drag to rotate, scroll to zoom.'
          : `Median balance for each expected monthly return (−2% to +10%), from ${lastDate || 'today'} out. Drag to rotate, scroll to zoom.`}
      </p>
      {on
        ? <Plot data={data} layout={layout} height="clamp(20rem, 65vh, 34rem)" label={`3D ${view} surface`} />
        : <button type="button" className="btn btn--outline" onClick={() => setOn(true)}>Show 3D view</button>}
    </section>
  )
}
