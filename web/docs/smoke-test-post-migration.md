# Smoke Test Checklist — Post-Migration

Run after migrations `20260509000004` through `20260509000009` are applied.

## Pre-requisites

- [ ] Migrations applied to Supabase
- [ ] Vercel deployment complete
- [ ] Have two test accounts ready (main + buddy)

---

## 1. Username & Auth

- [ ] **Sign up with new username** — go to /signup, enter username (3-20 chars, lowercase/numbers/underscores), confirm it saves
- [ ] **Login with username** — on /login, enter username instead of email, confirm lookup resolves and login works
- [ ] **Login with email** — same account, login with email directly, confirm it works

## 2. Five Score Readouts

- [ ] **Log in as main user** — navigate to /u tab
- [ ] **Check scores display** — verify position/velocity/acceleration/jerk/snap boxes show:
  - Real numbers if you have listening history
  - "—" (em-dash) if insufficient history (not 0)
- [ ] **Hover tooltips** — hover the (i) icon on each score, confirm tooltip text appears

## 3. Leaderboard (Two Users)

- [ ] **Log in as buddy** — separate browser/incognito
- [ ] **Both on leaderboard** — navigate to /u, confirm both users appear in the leaderboard table
- [ ] **Scores visible** — confirm score and listening_minutes columns have values

## 4. Social Feed & Visibility

- [ ] **Open social feed** — on /u tab, scroll to Activity Feed section
- [ ] **Check delta shown** — confirm entries show username, delta value, direction arrow
- [ ] **source_action hidden** — confirm NO "(cause text)" appears when visibility is off
- [ ] **As admin, toggle reveal_action ON**:
  - Go to /admin → Score Visibility tab
  - Find your user, check the box for one score type
  - Return to /u, refresh
  - Confirm the cause text NOW appears for that score type, only for you

## 5. Tooltips (Admin)

- [ ] **Edit site-wide default** — go to /admin → Tooltips tab
  - Click EDIT on one score type (e.g., "position")
  - Change text, save
  - As regular user on /u, hover the (i) icon, confirm new text shows
- [ ] **Add per-user override**:
  - In Tooltips tab, find a user row, click the "—" for a score type
  - Enter override text, save
  - As that user, confirm override text shows (not default)

## 6. Visualizer

- [ ] **Click fullscreen** — on /m tab, click fullscreen button (⛶), confirm browser enters fullscreen
- [ ] **Exit fullscreen** — press Esc or click ✖, confirm exits cleanly
- [ ] **Click gear icon** — confirm settings panel opens
- [ ] **Gear above MHEU nav** — confirm gear icon (z-index 1100) is not hidden behind the nav bar (z-index 1000)
- [ ] **Scope button gone** — confirm there is NO button to toggle between "viz" and "scope" modes in the gear menu

## 7. Admin Tabs

Visit each admin tab and confirm no errors (especially "relationship" errors from missing FKs):

- [ ] /admin → Users tab — loads user list
- [ ] /admin → Passwords tab — loads user list with reset buttons
- [ ] /admin → OAuth tab — loads connections list
- [ ] /admin → Life Scores tab — loads (may be empty if no data)
- [ ] /admin → Leaderboard tab — loads slots
- [ ] /admin → Presets tab — loads visualizer presets
- [ ] /admin → Score Visibility tab — loads users with checkboxes
- [ ] /admin → Tooltips tab — loads defaults + overrides

## 8. OAuth Connections

- [ ] **Connect Discord** — on /e (Account) page, click Connect for Discord
  - Confirm OAuth redirect to Discord
  - Authorize the app
  - Confirm redirect back to /e with success message
- [ ] **Apple Health disabled** — confirm Apple Health shows "iOS Only" message and Connect button is disabled

## 9. Auto-refresh Behavior

- [ ] **30-second refresh** — on /u tab, wait 30 seconds, confirm feed updates (check network tab)
- [ ] **Pause on hidden** — switch to another browser tab, wait 30+ seconds, confirm NO network requests to /api/scores during hidden period

---

## Known Issues Found in Audit

| Issue | Severity | Description |
|-------|----------|-------------|
| score_events not written | HIGH | No code writes to score_events on score recalc — social feed will be empty |
| Auto-refresh no pause | MEDIUM | UserCompetitionTab interval doesn't pause on visibilitychange |
| RLS allows source_action read | LOW | score_events RLS USING(true) allows direct DB queries to see source_action; API filters it but RLS doesn't |
| user_listening_stats RLS | LOW | "Service can manage" policy WITH CHECK(true) allows anon writes theoretically |

---

## Sign-off

| Tester | Date | Result |
|--------|------|--------|
|        |      |        |
