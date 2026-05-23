# Branch Audit — 2026-05-22

Audit of all four remote branches prior to consolidation into a single `main`.

## Branches

| Branch | Latest commit | Has /web | Has vercel.json | Submodule? | Status |
|---|---|---|---|---|---|
| **Desktop** | `743f21e` defer Butterchurn init | yes, complete | yes (`web/vercel.json`) | yes (`Visual` gitlink) | **KEEPER** |
| web-app | `7537b70` untrack web/.vercel/output | yes, older | yes | yes (same gitlink) | drop |
| refactor/consolidate | `cba0b19` add .js extensions | yes, older | yes | yes (same gitlink) | drop |
| claude/lucid-payne-2538da | `479aa1c` audit refactor batch | yes, older | yes | yes (same gitlink) | drop |

## Diff vs Desktop

- Desktop vs **web-app**: +1627 / -11522 across 97 files. Desktop holds: scoring engine, accent colors, account UI, admin palette, 8+ newer migrations, real-time scoring, butterchurn null-GL fix.
- Desktop vs **refactor/consolidate**: +1241 / -10513 across 92 files. Missing scoring engine, accent migrations.
- Desktop vs **claude/lucid-payne-2538da**: +1659 / -11523 across 100 files. Missing same plus polling/spotify rework.

## Deployability

All four branches would currently fail Vercel deploy due to the `Visual` submodule gitlink at the repo root (`160000 e4857afcc275715dce63c3c2cf692182bfe9e475 Visual`). No `.gitmodules` file is present, which is why the submodule fetch fails in 2 seconds.

`web/vercel.json` is correct: `framework: vite`, `outputDirectory: dist`, daily cron at `/api/cron/recompute`. Vercel project `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` is configured with `rootDirectory: web`, so the existing setup is sound once the gitlink is removed.

## Keeper Justification

`Desktop` is the only branch with:
- Real-time scoring (commit `fb9dd10`)
- API consolidation to 12 functions (`cb6822e`, `0b01bed`)
- Daily cron (Hobby tier compliant) (`7fff234`)
- `.vercel/output` removal fixes (`7fff234`, `f29e75f`, `94da01d`)
- Butterchurn null-GL deferred init (`743f21e`)

## Next Steps

1. Remove `Visual` submodule from Desktop.
2. Push Desktop state to `main`, delete the other three remotes.
3. Set `main` as default.
