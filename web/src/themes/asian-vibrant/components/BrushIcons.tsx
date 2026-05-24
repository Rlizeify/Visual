import type { CSSProperties, ReactNode } from 'react'

/**
 * Asian Vibrant brushstroke icon set.
 *
 * All icons are inline SVG using hand-drawn-style paths with slight
 * imperfection (asymmetric curves, varied stroke widths). Default color
 * is `var(--av-ink)`; hover/active states should set `color` on the
 * parent and the SVG inherits via `currentColor`.
 */

interface IconProps {
  size?: number
  color?: string
  style?: CSSProperties
}

const featherFilter = (
  <filter id="av-feather">
    <feGaussianBlur stdDeviation="0.25" />
  </filter>
)

function svgWrap(size: number, color: string | undefined, style: CSSProperties | undefined, children: ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ color: color ?? 'currentColor', display: 'block', ...style }}
      aria-hidden
    >
      <defs>{featherFilter}</defs>
      {children}
    </svg>
  )
}

export function PlayBrush({ size = 24, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <path
      d="M 8 5 L 8 27 L 27 16 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinejoin="round"
      filter="url(#av-feather)"
    />
  ))
}

export function PauseBrush({ size = 24, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      <path d="M 10 5 Q 10.6 16 9.6 27" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" filter="url(#av-feather)" />
      <path d="M 21 5 Q 21.4 16 22 27" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" filter="url(#av-feather)" />
    </>
  ))
}

export function NextBrush({ size = 24, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      <path d="M 5 8 L 14 16 L 5 24" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#av-feather)" />
      <path d="M 16 8 L 25 16 L 16 24" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#av-feather)" />
    </>
  ))
}

export function PrevBrush({ size = 24, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      <path d="M 27 8 L 18 16 L 27 24" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#av-feather)" />
      <path d="M 16 8 L 7 16 L 16 24" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#av-feather)" />
    </>
  ))
}

export function ShuffleBrush({ size = 24, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      <path d="M 4 8 Q 13 9 16 16 Q 19 23 28 24" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
      <path d="M 4 24 Q 13 23 16 16 Q 19 9 28 8" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
      <path d="M 24 4 L 28 8 L 24 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 24 20 L 28 24 L 24 28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ))
}

export function GearBloom({ size = 24, color, style }: IconProps) {
  // Stylized chrysanthemum bloom — petal flicks around a center circle.
  return svgWrap(size, color, style, (
    <>
      <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        const x1 = 16 + Math.cos(a) * 7
        const y1 = 16 + Math.sin(a) * 7
        const x2 = 16 + Math.cos(a) * 13
        const y2 = 16 + Math.sin(a) * 13
        const cxa = 16 + Math.cos(a + 0.3) * 11
        const cya = 16 + Math.sin(a + 0.3) * 11
        return (
          <path
            key={i}
            d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cxa.toFixed(1)} ${cya.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
            filter="url(#av-feather)"
          />
        )
      })}
    </>
  ))
}

export function CloseBrush({ size = 18, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      <path d="M 6 6 Q 16 14 26 26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" filter="url(#av-feather)" />
      <path d="M 26 6 Q 16 18 6 26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" filter="url(#av-feather)" />
    </>
  ))
}

export function FullscreenBrush({ size = 22, color, style }: IconProps) {
  return svgWrap(size, color, style, (
    <>
      {/* Four corner brackets */}
      <path d="M 4 10 L 4 4 L 10 4" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
      <path d="M 28 10 L 28 4 L 22 4" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
      <path d="M 4 22 L 4 28 L 10 28" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
      <path d="M 28 22 L 28 28 L 22 28" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" filter="url(#av-feather)" />
    </>
  ))
}

/**
 * Hanko (seal stamp) — a small crimson square with a glyph carved out
 * in pale paper color. Used for: tab-audio capture button, magnitude
 * badges, ACTIVE indicators.
 */
export function Hanko({ glyph, size = 28, color = 'var(--av-crimson)', glyphColor = 'var(--av-paper)', style }: { glyph: string; size?: number; color?: string; glyphColor?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        color: glyphColor,
        borderRadius: '3px',
        fontFamily: "'Ma Shan Zheng', serif",
        fontSize: `${Math.round(size * 0.58)}px`,
        lineHeight: 1,
        boxShadow: '0 1px 0 rgba(26,20,16,0.20), inset 0 0 0 1px rgba(244,236,216,0.18)',
        userSelect: 'none',
        ...style,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  )
}
