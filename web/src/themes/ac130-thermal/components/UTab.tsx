// UTab for AC-130 Thermal re-uses the shared UserCompetitionTab.
//
// The underlying component reads `--accent-color*` + `--color-bg`
// from CSS variables and uses the SocialFeedRow surface from the
// active theme — so AC-130's tokens.css + SocialFeedRow give the
// page the HUD treatment automatically. No layout fork needed.
//
// If a future iteration wants a heavier per-theme UTab layout
// (e.g. lat/lon overlays per row), this re-export can be swapped
// for a custom component on the same /u contract.
export { default } from '../../../components/tabs/UserCompetitionTab'
