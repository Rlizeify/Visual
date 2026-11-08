// Guided tour: fogs the page except one element, explains it, steps on.
//
// Steps name their target with a CSS selector; a step whose target isn't
// on the page (e.g. no benchmark data) is skipped. The fog is four blurred
// panels around the target, so the page can't be clicked while touring.
// Keyboard: → / Enter next, ← back, Esc closes. Focus stays in the card.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './tour.css'

export interface TourStep { target: string; title: string; body: string }

interface Props { steps: TourStep[]; onClose: (finished: boolean) => void }

interface Box { top: number; left: number; width: number; height: number }

const PAD = 8
const CARD_GAP = 12

function navHeight(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--nav-h')
  return parseFloat(v) || 56
}

export default function Tour({ steps, onClose }: Props) {
  // Resolved after the page has committed, so sections rendered alongside
  // the tour are found.
  const [live, setLive] = useState<TourStep[]>([])
  useLayoutEffect(() => { setLive(steps.filter(s => document.querySelector(s.target))) }, [steps])
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(0)
  const step = live[i]
  const last = i === live.length - 1

  const close = useCallback((finished: boolean) => onClose(finished), [onClose])
  const next = useCallback(() => { if (last) close(true); else setI(n => n + 1) }, [last, close])
  const back = useCallback(() => setI(n => Math.max(0, n - 1)), [])

  // Scroll the target into view (below the nav), then follow it.
  useEffect(() => {
    const el = step && document.querySelector<HTMLElement>(step.target)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const r = el.getBoundingClientRect()
    const pinned = !!el.closest('header') // e.g. the nav avatar: already on screen
    const room = window.innerHeight - navHeight() - 180 // leave space for the card
    const y = r.height > room
      ? window.scrollY + r.top - navHeight() - PAD * 2
      : window.scrollY + r.top - navHeight() - Math.max(PAD * 2, (room - r.height) / 2)
    if (!pinned) window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' })
    let raf = 0
    const track = () => {
      const b = el.getBoundingClientRect()
      setBox(prev => prev && prev.top === b.top && prev.left === b.left && prev.width === b.width && prev.height === b.height
        ? prev : { top: b.top, left: b.left, width: b.width, height: b.height })
      raf = requestAnimationFrame(track)
    }
    track()
    return () => cancelAnimationFrame(raf)
  }, [step])

  useLayoutEffect(() => { setCardH(cardRef.current?.offsetHeight ?? 0) }, [step, box?.width])
  useEffect(() => { cardRef.current?.querySelector<HTMLElement>('[data-primary]')?.focus() }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
      else if (e.key === 'Tab') {
        // Keep focus inside the card.
        const f = cardRef.current?.querySelectorAll<HTMLElement>('button')
        if (!f?.length) return
        const first = f[0], end = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus() }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, next, back])

  if (!step) return null

  const vw = window.innerWidth, vh = window.innerHeight
  const top = navHeight()
  // Hole, clamped to the visible area under the nav (unless the target is in it).
  const h = box && {
    top: Math.max(box.top < top ? 0 : top, box.top - PAD),
    left: Math.max(0, box.left - PAD),
    right: Math.min(vw, box.left + box.width + PAD),
    bottom: Math.min(vh, box.top + box.height + PAD),
  }
  // Card: below the hole, else above, else pinned to the bottom.
  let cardTop = vh - cardH - CARD_GAP
  if (h && h.bottom + CARD_GAP + cardH <= vh - CARD_GAP) cardTop = h.bottom + CARD_GAP
  else if (h && h.top - CARD_GAP - cardH >= top + CARD_GAP) cardTop = h.top - CARD_GAP - cardH

  const titleId = 'tour-title'
  return createPortal(
    <div className="tour" role="presentation">
      {h ? (
        <>
          <div className="tour__fog" style={{ top: 0, left: 0, width: '100%', height: h.top }} />
          <div className="tour__fog" style={{ top: h.bottom, left: 0, width: '100%', height: Math.max(0, vh - h.bottom) }} />
          <div className="tour__fog" style={{ top: h.top, left: 0, width: h.left, height: h.bottom - h.top }} />
          <div className="tour__fog" style={{ top: h.top, left: h.right, width: Math.max(0, vw - h.right), height: h.bottom - h.top }} />
          <div className="tour__hole" style={{ top: h.top, left: h.left, width: h.right - h.left, height: h.bottom - h.top }} />
        </>
      ) : <div className="tour__fog" style={{ inset: 0 }} />}

      <div ref={cardRef} className="tour__card" role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ top: Math.max(top + CARD_GAP, cardTop) }}>
        <p className="tour__count">{i + 1} of {live.length}</p>
        <h2 id={titleId} className="tour__title">{step.title}</h2>
        <p className="tour__body">{step.body}</p>
        <div className="tour__bar" role="progressbar" aria-valuemin={1} aria-valuemax={live.length} aria-valuenow={i + 1}>
          <span style={{ width: `${((i + 1) / live.length) * 100}%` }} />
        </div>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => close(false)}>Skip tour</button>
          <span className="tour__spacer" />
          {i > 0 && <button type="button" className="btn btn--sm" onClick={back}>Back</button>}
          <button type="button" className="btn btn--primary btn--sm" data-primary onClick={next}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
