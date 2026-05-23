# Archived: E-tab Account Page

**Archived**: 2026-05-23
**Replaced by**: profile dropdown anchored to the new top-left nav icon
(see `web/src/themes/frutiger-aero/components/ProfileDropdown.tsx`).

## What was here

`AccountPage.tsx` — the full account/customization UI that lived on the
E (Entertainment) tab. Mounted by `EntertainmentTab.tsx`. Contained:

- Avatar circle + upload (Supabase Storage `avatars/` bucket → `profiles.avatar_url`)
- Username edit (`profiles.username`)
- Email row (read-only from `auth.users.email`)
- Member-since + Last-login dates
- Accent color picker (palette + custom hex → `profiles.accent_color`)
- Connected services list (Spotify / Discord / MyNetDiary / Apple) via
  `/api/oauth?action=connections` and the OAuth flows
- MyNet Diary connect modal (POST `/api/oauth?provider=mynetdiary`)

## Why archived

The theme-system migration (PART 2 of the foundation) moved the
account/customization controls into a persistent profile dropdown
accessible from any tab via a top-left icon in the nav. The E tab
became a stub ("Entertainment coming soon") until that feature ships.

## Where each piece lives now

| Original control            | New home                                            |
|-----------------------------|-----------------------------------------------------|
| Avatar upload               | ProfileDropdown.tsx (`handleAvatar`)                |
| Username edit               | not migrated yet (open follow-up)                   |
| Accent color picker         | ProfileDropdown.tsx (palette + custom hex)          |
| Reveal-action toggles       | ProfileDropdown.tsx (NEW — was admin-only before)   |
| Theme switcher              | ProfileDropdown.tsx (NEW)                           |
| Sign out                    | ProfileDropdown.tsx (`handleSignOut`)               |
| Connected services list     | not migrated yet (open follow-up)                   |
| MyNet Diary connect modal   | not migrated yet (open follow-up)                   |

## Reviving

If a future task brings the connected-services UI back, copy the
relevant sections out of this file rather than reinventing the OAuth
flow plumbing. The Supabase schema and `/api/oauth` endpoints are
unchanged.
