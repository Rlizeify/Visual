# Social Feed Audit — 2026-05-23 (T4)

Scope: catalog the current U-tab feed implementation so T4 can rebuild it
without breaking anything downstream.

## Current renderer

Inline block inside `web/src/components/tabs/UserCompetitionTab.tsx`,
lines 564-607. Maps `feedEvents` (cap 200) to `<div>` rows with hardcoded
rgba backgrounds and inline styles. No row component, no detail expansion,
no slide-in animation, no diff updates — the whole list re-renders every
30s poll.

## Data source

- **Endpoint**: `GET /api/scores?action=events` (handler in
  `web/api/scores.ts:handleEvents`, lines 427-482).
- **Auth**: optional. If a `Bearer <jwt>` is sent, the server resolves
  `currentUserId` from Supabase auth and uses it to gate `source_action`
  visibility. Anonymous callers get the public payload (no source lines).
- **Response shape**:
  ```ts
  { events: Array<{
      id, user_id, username, avatar_url, accent_color,
      score_type, delta, direction, source_action, created_at
  }> }
  ```
- **Server cap**: 50 most-recent events (`.limit(50)`). Client caps at 200
  via `FEED_MAX_ENTRIES`, but the server only ever returns ≤50, so the
  effective cap is 50.

## Polling

- 30s interval. `UserCompetitionTab.tsx:195` → `setInterval(fetchData, 30000)`.
- `fetchData` calls THREE endpoints per tick: `/api/scores`,
  `/api/scores?action=user-scores`, `/api/scores?action=events`.
- `visibilitychange` handler (lines 220-228): `stopInterval()` when hidden,
  `triggerRecompute() + fetchData() + startInterval()` when visible.
- Additional `focus` listener fires `triggerRecompute() + fetchData()`.

The visibility handler is solid — keep it. T4 only needs to swap the
feed renderer; the polling stays on `UserCompetitionTab` so the leaderboard
and user-scores cards continue to share the same tick.

## Avatars

Source: `public.profiles.avatar_url` (text). Set on signup by the
`handle_new_user()` trigger from `raw_user_meta_data->>'avatar_url'`.
Editable by the user via the Account page (per the changelog).

There is a separate `public.users` table that maps `spotify_user_id ↔ id`,
but `avatar_url` lives only on `profiles`. Decision: **always read avatar
from `profiles.avatar_url`**. If null, fall back to a colored letter
circle using the first character of `username`/`display_name` and the
user's `accent_color`.

`handleEvents` already joins `profiles(username, display_name, avatar_url,
accent_color)` via the FK on `score_events.user_id`, so the payload
already carries the right fields.

## Accent color CSS vars (T1 wiring)

Defined in `web/src/styles/tokens.css` (defaults) and overridden per-user
by `applyAccentColor(hex)` in `web/src/lib/accentColor.ts`:

| Variable | Use |
|----------|-----|
| `--accent-color` | Primary text + active button color |
| `--accent-color-bright` | Same as accent; used where bright is wanted |
| `--accent-color-dim` | 60% alpha — borders + inactive text |
| `--accent-color-bg` | 8% alpha — selected backgrounds |
| `--accent-color-border` | 40% alpha — default borders |
| `--accent-color-glow` | 30% alpha — shadows / text-shadow |

`AuthContext` loads `profiles.accent_color` for the current user on auth
state change and applies it via `applyAccentColor`. This means the
*viewer's* accent paints the chrome (tabs, cards). Per-row accents
(other users' colors) come straight from `event.accent_color` in the
payload — not from CSS variables — and stay correct regardless of viewer.

The viewer's chrome repaints live when accent changes in the E tab
because `applyAccentColor` writes to `:root` style properties; any
`var(--accent-color*)` reference recolors on the next paint.

## reveal_action — source-line visibility

- Table: `public.user_score_visibility (user_id, score_type, reveal_action)`.
- Per-user, per-score-type. Admin-managed via `/admin` only — users
  cannot self-toggle (RLS allows SELECT on own rows only; INSERT/UPDATE/
  DELETE restricted to `is_admin(auth.uid())`).
- Per-event override: `score_events.visibility_override` (boolean,
  nullable) lets the server force-show or force-hide a single event.

**Server-side enforcement** (already correct, see scores.ts:464-466):
```ts
const isOwnEvent = currentUserId === e.user_id
const userVisibility = visibilityMap[e.user_id]?.[e.score_type] ?? false
const showSource = isOwnEvent && (e.visibility_override ?? userVisibility)
// ...
source_action: showSource ? e.source_action : null,
```

Two conditions, both must be true:
1. **`isOwnEvent`** — the event belongs to the viewer.
2. **`reveal_action` is true** for that user × score_type (or the
   per-event `visibility_override` is true).

Other users never see a viewer's `source_action`, regardless of the
viewer's reveal settings. The viewer never sees another user's source
line, regardless of that other user's settings. This is the right
posture.

T4 will additionally re-assert the condition client-side as a defense-
in-depth comment block. The client cannot widen visibility (the field is
already null in the payload for unauthorized viewers), but it makes the
rule visible in the UI code so a future change doesn't silently widen
the rendering.

## Empty state

Currently: `feedEvents.length === 0` → `"No activity yet"`. T4 spec:
centered dim message `"No activity yet. Listen to something."`

## Files T4 will touch

- `web/src/components/tabs/UserCompetitionTab.tsx` — replace the inline
  feed block with `<SocialFeed events={feedEvents} currentUserId={...} />`.
  Keep polling + visibility handler unchanged.
- `web/src/features/feed/SocialFeed.tsx` (new) — top-level list.
- `web/src/features/feed/FeedRow.tsx` (new) — single row.
- `web/src/features/feed/FeedRowDetail.tsx` (new) — inline expanded panel.
- `web/src/features/feed/FeedAvatar.tsx` (new) — avatar with fallback.
- `web/src/features/feed/MagnitudeBadge.tsx` (new) — +5 / −3 badge.
- `web/src/features/feed/RelativeTimestamp.tsx` (new) — "13h ago".
- `web/src/features/feed/useFeedDiff.ts` (new) — diff hook for slide-in.
- `web/src/features/feed/eventCopy.ts` (new) — verb pool + event copy +
  deterministic hash.

Old inline feed block: snapshot into
`web/src/archive/social-feed-inline/UserCompetitionTab-feed-snippet.md`
with a note pointing to the new modules.

## Out of scope for T4

- Server-side cap (still 50 most-recent events; client caps at 200 but
  receives at most 50). If the user wants a larger feed they need to
  bump the `.limit(50)` in `handleEvents`.
- Adding any new field to `score_events`. Existing payload is sufficient
  for the spec.
- Click-to-seek / click-to-anything on feed rows other than expand/collapse.
