// Section bookmarks: a fixed rail on the left on wide screens, a sticky
// scrolling strip under the nav on narrow ones. The section in view is
// highlighted (IntersectionObserver on the section headings).

import { useEffect, useState } from 'react'

export interface Bookmark { id: string; label: string }

export default function Bookmarks({ items }: { items: Bookmark[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const key = items.map(i => i.id).join(',')

  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver(entries => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting)
      // The first heading still in the top part of the screen, else the last one above it.
      const hit = items.find(i => seen.get(i.id))
      if (hit) setActive(hit.id)
    }, { rootMargin: '-56px 0px -55% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => {
    document.getElementById(id)?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <nav className="fund-marks" aria-label="Fund sections">
      <ul>
        {items.map(i => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined}
              onClick={e => { e.preventDefault(); go(i.id) }}>{i.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
