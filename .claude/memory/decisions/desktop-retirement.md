# 2026-05-23 — Status note: desktop is retired into `legacy/desktop/`

**Context.** Earlier sessions (1–8) treated the Electron desktop as
the active product. Sometime before the branch consolidation, the
entire `apps/desktop/` tree was moved to `legacy/desktop/` (commits
`dfda553 chore: consolidate desktop branch into legacy/desktop/`
and `31d6cc4 chore: fold root apps/ into legacy/desktop/`). The
move was never logged in the decision index, so the planning model
and the priorities/roadmap files kept describing the desktop as
in-progress through session 12.

**Status note (not a new decision).** The retirement happened.
This file exists to make it discoverable from
`decisions/index.md` so future sessions don't re-discover it from
git archaeology.

**Implications.**
- The active surface is the MHEU web app at `https://mheu.lol`,
  source tree `/web`.
- `legacy/desktop/` has its own `.claude/` memory tree from the
  pre-move era. That tree is NOT loaded into active sessions;
  the root `.claude/` is canonical.
- The Path B "WASAPI broadcaster" plan from
  `reactivity-architecture.md` is still on the table — it just
  means reviving `legacy/desktop/` or building a fresh Electron
  shell. The original decision stands; only the timing is open.
- The Spotify-token protection plan from the old roadmap (Electron
  `app.getPath('userData')` per-machine storage) is desktop-only
  and tabled until the desktop is revived.

**No code change.** This is documentation only.
