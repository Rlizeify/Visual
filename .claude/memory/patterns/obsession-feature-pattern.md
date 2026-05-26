# Pattern — Hidden Subtree with Forced Theme Override

**Observed in**: OBSESSION feature (2026-05-25)

When a feature needs to be:
- Hidden from normal navigation (no nav tile, no link)
- Locked to a specific theme regardless of user preference
- Per-user RLS-isolated
- Mounted at a fixed route subtree

…use this shape:

## Shape

1. **Egg hook** lives at app root (`useObsessionEgg()` mounted
   from `AppRoutes`). Window-level `keydown` buffer + 3s timeout.
   Skips when an input is focused, modifier keys are held, or no
   user is signed in. Calls `navigate('/feature')` on match.

2. **Route mount** as catch-all subtree:
   ```tsx
   <Route path="/feature/*" element={<FeatureRoutes />} />
   ```
   placed before the app catch-all so the subtree owns its own
   nested routing.

3. **Theme override provider** at the subtree root wraps `<Routes>`:
   - On mount: read current `document.documentElement.dataset.theme`,
     set to forced id.
   - On unmount: restore the saved value.
   - **Never** call the shared `ThemeContext.setTheme()` — that
     would write to `profiles.theme_id` and permanently flip the
     user's choice.

4. **Routing-gate exemption**: any global routing effect that might
   bounce the user (auth gate, integration gate) needs an early
   `if (isFeatureRoute) return` so the egg actually lands.

5. **Standalone background flag**: if the app conditionally shows
   global chrome (visualizer, theme decorations) based on route,
   add the feature path to the chrome-suppression set.

## Why not …

- **Why not a hidden nav button?** Defeats the point. Eggs are
  for users who already know.
- **Why not call `setTheme()`?** Persists to Supabase, flips the
  user's chosen theme. They'd have to manually flip back.
- **Why not a route-level layout `ThemeProvider`?** The shared
  context publishes a global theme; nesting providers is messy
  and surfaces outside the subtree still see the override during
  the React tree walk.

## Anti-patterns to avoid

- **Don't** read `mem` or other module-level mutable state from
  routing effects. Lift it into React state. Module-level changes
  don't trigger re-renders, so the gate races itself.
- **Don't** trust `setInterval` for any "duration since X" math.
  Tab throttling destroys it. Store `started_at` and compute
  elapsed from `Date.now()`.
- **Don't** add a new Vercel function for a single small endpoint
  when an existing function can be router-extended. The Hobby
  ceiling is 12.
