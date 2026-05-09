# Code Audit Findings — 2026-05-09

Audit of code paths touching new migrations before production deployment.

## 1. Table/Column Name Verification

| File | Line | Table | Columns Used | Match? | Issue |
|------|------|-------|--------------|--------|-------|
| api/scores.ts | 112-116 | user_listening_stats | date, listening_minutes | YES | — |
| api/scores.ts | 125-127 | tooltip_defaults | score_type, text | YES | — |
| api/scores.ts | 129-132 | tooltip_overrides | score_type, text, user_id | YES | — |
| api/scores.ts | 134-137 | user_score_visibility | score_type, reveal_action, user_id | YES | — |
| api/scores.ts | 168-175 | score_events | id, user_id, score_type, delta, source_action, visibility_override, created_at | YES | — |
| api/scores.ts | 182-185 | user_score_visibility | user_id, score_type, reveal_action | YES | — |
| api/admin/tooltips.ts | 13-16 | tooltip_defaults | score_type, text | YES | — |
| api/admin/tooltips.ts | 50-53 | tooltip_overrides | user_id, score_type, text | YES | — |
| api/admin/leaderboard.ts | 24-27 | user_score_visibility | user_id, score_type, reveal_action | YES | — |
| api/auth.ts | 27-31 | profiles | username, id | YES | — |
| api/admin/users.ts | 23-26, 91-94 | profiles | id, username, display_name, is_admin | YES | — |
| src/components/tabs/AccountPage.tsx | 44-48 | profiles | username, display_name, avatar_url, created_at | YES | — |

**Result**: All column names match migration definitions exactly.

---

## 2. RLS Policy Analysis

### score_events

| Policy | Type | Condition | Issue |
|--------|------|-----------|-------|
| "Anyone can read score events" | SELECT | USING(true) | **LOW**: Allows direct DB read of source_action. API filters it, but bypassed if someone queries Supabase directly. |
| "Service can insert score events" | INSERT | WITH CHECK(true) | OK — service role only in practice |

**Recommendation**: Change SELECT policy to:
```sql
-- Only allow reading source_action for own rows
USING (
  source_action IS NULL
  OR user_id = auth.uid()
)
```
Or use a view that strips source_action for non-owners.

### user_listening_stats

| Policy | Type | Condition | Issue |
|--------|------|-----------|-------|
| "Users can read own listening stats" | SELECT | auth.uid() = user_id | OK |
| "Service can manage listening stats" | ALL | WITH CHECK(true) | **LOW**: WITH CHECK(true) on ALL allows anon INSERT/UPDATE/DELETE. Should be service-role only. |

**Recommendation**: Remove the ALL policy, use service role exclusively (bypasses RLS).

### Other tables (user_score_visibility, tooltip_defaults, tooltip_overrides)

All policies correctly gated on `auth.uid() = user_id` or `public.is_admin(auth.uid())`.

---

## 3. Five-Score Calculation Audit

File: `api/scores.ts:36-92`

| Score | Formula | Code | Match? |
|-------|---------|------|--------|
| position | total listening minutes this week | `thisWeek.reduce((sum, s) => sum + s.listening_minutes, 0)` | YES |
| velocity | listening minutes today | `todayStats?.listening_minutes ?? null` | YES |
| acceleration | today - yesterday | `lastDays[0] - lastDays[1]` | YES |
| jerk | change in acceleration | `acceleration - prevAcceleration` | YES |
| snap | change in jerk | `jerk0 - jerk1` | YES |

**Insufficient history handling**: Returns `null` which renders as "—" in UI (line 271).

**Result**: All formulas correct.

---

## 4. Social Feed Audit

### score_events Write

**CRITICAL ISSUE**: No code writes to `score_events` table.

Searched for:
- `score_events.*insert`
- `insert.*score_events`
- `\.from\('score_events'\)\.insert`

**Result**: Zero matches. The social feed will be empty until write logic is added.

### source_action Visibility

File: `api/scores.ts:193-206`

```typescript
const isOwnEvent = currentUserId === e.user_id
const userVisibility = visibilityMap[e.user_id]?.[e.score_type] ?? false
const showSource = isOwnEvent && (e.visibility_override ?? userVisibility)
```

**Result**: Correctly shows source_action only to own user when reveal_action is true.

### Auto-refresh Interval

File: `src/components/tabs/UserCompetitionTab.tsx:120-132`

```typescript
const interval = setInterval(fetchData, 30000) // 30 seconds OK
// ...
const handleFocus = () => fetchData()
window.addEventListener('focus', handleFocus)
```

**ISSUE**: No `visibilitychange` listener to pause interval when tab is hidden.
Compare to `GroovyBackground.tsx:97-106` which correctly pauses on `document.hidden`.

---

## 5. Tooltip Audit

File: `api/scores.ts:140-146`

```typescript
// Merge tooltips — defaults first, then overrides
for (const t of defaultTooltips || []) {
  tooltips[t.score_type] = t.text
}
for (const t of userOverrides || []) {
  tooltips[t.score_type] = t.text  // Override wins
}
```

**Result**: Per-user override correctly takes precedence.

Admin edit: `TooltipsTab.tsx` handles both defaults (type=defaults) and overrides (type=overrides).

---

## 6. Visualizer Fixes Audit

### Scope Button

Searched for: `scope\b|Scope`

- `useVizSettings.ts:6` — `type VizMode = 'viz' | 'scope'` (type exists)
- `GearMenu.tsx` — NO UI to toggle VizMode

**Result**: Scope toggle button is removed from UI. Only the type definition remains (harmless).

### Fullscreen Handler

File: `VisualizerPage.tsx:63-73`

```typescript
const handleFullscreen = async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else if (containerRef.current) {
    await containerRef.current.requestFullscreen()
  }
}
```

**Result**: Bound to `containerRef.current` (the full visualizer container).

### Gear Icon Z-Index

File: `VisualizerPage.tsx:234`

```typescript
zIndex: 1100, // Above MHEU nav (z-index 1000)
```

File: `MHEUShell.tsx:49`

```typescript
zIndex: 1000,  // Nav bar
```

**Result**: Gear (1100) > Nav (1000). Correctly layered.

---

## Summary

| Category | Status |
|----------|--------|
| Column names | PASS |
| RLS policies | 2 LOW issues |
| Five-score formulas | PASS |
| score_events writes | **FAIL** — not implemented |
| source_action visibility | PASS |
| Auto-refresh pause | FAIL — not implemented |
| Tooltip precedence | PASS |
| Scope button removed | PASS |
| Fullscreen handler | PASS |
| Gear z-index | PASS |
