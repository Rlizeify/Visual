// Thin Plotly wrapper. The library (2D + WebGL 3D, ~1.7 MB) loads on
// first use, so it only ships to people who open /fund. Sized by a
// ResizeObserver per the responsive rules.

import { useEffect, useRef, useState } from 'react'

type PlotlyLib = typeof import('plotly.js-gl3d-dist-min').default
let lib: Promise<PlotlyLib> | null = null
const loadPlotly = () => (lib ??= import('plotly.js-gl3d-dist-min').then(m => m.default))

interface Props {
  data: Record<string, unknown>[]
  layout: Record<string, unknown>
  height: string
  label: string
  onHoverX?: (x: number | string) => void
}

export default function Plot({ data, layout, height, label, onHoverX }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = el.current
    if (!node) return
    let cancelled = false
    loadPlotly()
      .then(P => {
        if (cancelled) return
        return P.react(node, data, layout, { displaylogo: false, responsive: false, modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'] })
          .then(() => { if (!cancelled) setReady(true) })
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Chart failed to load') })
    return () => { cancelled = true }
  }, [data, layout])

  useEffect(() => {
    const node = el.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { loadPlotly().then(P => { if (node.isConnected) P.Plots.resize(node) }) })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const node = el.current as (HTMLDivElement & { on?: (ev: string, cb: (e: { points?: { x: number | string }[] }) => void) => void }) | null
    if (!node || !ready || !onHoverX || !node.on) return
    node.on('plotly_hover', e => { const x = e.points?.[0]?.x; if (x !== undefined) onHoverX(x) })
  }, [ready, onHoverX])

  useEffect(() => () => { const node = el.current; if (node) loadPlotly().then(P => P.purge(node)) }, [])

  return (
    <div className="fund-plot" style={{ height }}>
      <div ref={el} className="fund-plot__canvas" role="img" aria-label={label} />
      {!ready && !error && <p className="fund-plot__status">Loading chart…</p>}
      {error && <p className="fund-plot__status fund-err">{error}</p>}
    </div>
  )
}
