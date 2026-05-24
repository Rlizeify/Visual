# Loading Screen v1 (archived 2026-05-24)

The original MHEU splash. Two identical inline JSX blocks lived inside
`web/src/App.tsx` (lines 140-173 and 177-210 at archive time). They
were the only thing rendered while `authLoading || loading` was true,
or while a session-bearing user was about to hit `/login`/`/signup`/`/`.

## Why archived

Stone (2026-05-24) reported a forever-spinning splash caused by a
poisoned `mheu_token_expiry` value in `localStorage` that threw a
`RangeError` out of `migrateFromLocalStorage` and stalled boot. The
v1 splash had **no time limit**, **no diagnostic**, and **no recovery
action** — the only escape was opening DevTools and clearing
storage by hand.

Replaced by `web/src/components/LoadingScreen.tsx`, which has:

- Stage 1 (0-5s) — visually identical to v1.
- Stage 2 (5-15s) — adds an aria-live "taking longer than usual" line.
- Stage 3 (15-30s) — adds a help card with three recovery buttons:
  Try again / Clear cache & reload / Sign out & reload.
- Stage 4 (30s+) — auto-triggers Clear cache & reload, shows a banner.
- Loop protection — `sessionStorage.mheu_auto_recovered_at` guards
  against infinite reload loops.

## Files in this archive

- `splash.tsx.snapshot` — the original JSX. Identical block was
  duplicated twice in `App.tsx`; only one copy is preserved here.

## How to restore (not recommended)

Paste the JSX back into `App.tsx` at both render sites and remove
the `LoadingScreen` import. You will reintroduce the forever-spinner
class of bugs.

## Related

- `.claude/memory/progress/loading-screen-audit.md` — 10 failure modes
  catalogued before the rewrite.
- `.claude/memory/decisions/loading-screen-self-healing.md` — design
  rationale.
