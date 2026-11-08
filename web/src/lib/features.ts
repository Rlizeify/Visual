// Feature permissions — the one list of grantable features.
//
// Shared by the client (route gate, admin checkboxes) and the API
// (/api/admin/users validates keys against it). A grant is a row in
// public.feature_access (user_id, feature). Admin access is separate:
// profiles.is_admin.
//
// To add a feature (e.g. a fund or gaming tab):
//   1. Add an entry here. `default: false` unless every new account
//      should get it — defaults are also hard-coded in handle_new_user
//      (migration 20261107000001); change both together.
//   2. Set `feature: '<key>'` on its entry in src/app/routes.ts.
//   3. Give its tables a RESTRICTIVE "Feature gate" policy using
//      public.has_feature('<key>') so the data is locked, not just the page.

export interface Feature {
  key: string
  label: string
  default: boolean
}

export const FEATURES = [
  { key: 'visualizer', label: 'Visualizer', default: true },
  { key: 'investing', label: 'Investing', default: true },
  { key: 'obsession', label: 'Obsession', default: false },
  { key: 'fund', label: 'Fund', default: false },
] as const satisfies readonly Feature[]

export type FeatureKey = (typeof FEATURES)[number]['key']

export const DEFAULT_FEATURES: FeatureKey[] = FEATURES.filter(f => f.default).map(f => f.key)

export function isFeatureKey(k: unknown): k is FeatureKey {
  return typeof k === 'string' && FEATURES.some(f => f.key === k)
}
