// "DAY N" cumulative counter for the Obsession landing.
//
// N = days elapsed since the user's FIRST sight of the feature.
// We persist the first-seen ISO date in localStorage per user. If a
// user has never been seen, today becomes DAY 1 and we write the
// row. We do not persist this server-side — the count is a small
// motivational HUD readout, not load-bearing.
//
// On a fresh browser the counter resets to DAY 1. That's an accepted
// trade-off; the alternative (server table) adds DB load for a
// purely cosmetic widget.

import { todayLocalISODate, daysBetween } from './localDate'

const KEY = (userId: string) => `mheu_obsession_first_seen_${userId}`

export function readOrInitFirstSeen(userId: string): string {
  if (!userId) return todayLocalISODate()
  try {
    const cached = localStorage.getItem(KEY(userId))
    if (cached) return cached
    const today = todayLocalISODate()
    localStorage.setItem(KEY(userId), today)
    return today
  } catch {
    return todayLocalISODate()
  }
}

export function getDayCount(userId: string): number {
  const first = readOrInitFirstSeen(userId)
  return daysBetween(first, todayLocalISODate()) + 1
}
