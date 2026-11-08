// Which guided tours this device has finished, and the "replay" signal
// the account menu sends to the page that owns a tour.

const KEY = (name: string) => `mheu_tour_${name}_done`
export const TOUR_EVENT = 'mheu:tour'

export function tourDone(name: string): boolean {
  try { return localStorage.getItem(KEY(name)) === '1' } catch { return false }
}

export function markTourDone(name: string): void {
  try { localStorage.setItem(KEY(name), '1') } catch { /* private mode: tour shows again next time */ }
}

export function replayTour(name: string): void {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: name }))
}
