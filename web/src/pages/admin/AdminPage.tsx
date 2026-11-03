// /admin — mounted once, behind the registry's requiresRole: 'admin'.
// Sections come from features/admin/sections.ts; add admin features
// there, not here.

import { Suspense, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { sectionsFor } from '../../features/admin/sections'
import './admin.css'

export default function AdminPage() {
  const { user } = useAuth()
  const sections = sectionsFor(user?.email)
  const [tab, setTab] = useState<string>(sections[0]?.id ?? '')
  const active = sections.find(s => s.id === tab) ?? sections[0]
  const ActiveSection = active?.component

  return (
    <main className="page admin">
      <div className="container">
        <header className="admin__head">
          <p className="eyebrow">Admin</p>
          <h1 className="admin__title">Console</h1>
          <p className="faint admin__who">{user?.email}</p>
        </header>

        <nav className="admin__tabs" role="tablist" aria-label="Admin sections">
          {sections.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === active?.id}
              className="admin__tab" onClick={() => setTab(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>

        <section className="admin__body card" role="tabpanel">
          <Suspense fallback={<p className="faint">Loading…</p>}>
            {ActiveSection && <ActiveSection />}
          </Suspense>
        </section>
      </div>
    </main>
  )
}
