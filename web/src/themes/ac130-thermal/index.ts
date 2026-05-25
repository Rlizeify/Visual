import type { ThemeManifest } from '../types'
import './tokens.css'
import './theme.css'
import shell from './shell'

import DashboardShell from './components/DashboardShell'
import NavBar from './components/NavBar'
import ProfileDropdown from './components/ProfileDropdown'
import MTab from './components/MTab'
import HTabPlaceholder from './components/HTabPlaceholder'
import ETabPlaceholder from './components/ETabPlaceholder'
import UTab from './components/UTab'
import PlaybackControls from './components/PlaybackControls'
import GearMenu from './components/GearMenu'
import WaveformBar from './components/WaveformBar'
import SocialFeedRow from './components/SocialFeedRow'

/**
 * AC-130 Thermal — full theme.
 *
 * L3Harris-inspired fire-control display. Black void backdrop, neon
 * HUD-green wire chrome, scan lines, monospace caps wrapped in
 * brackets. Persistent corner HUD plates (timestamp, coords,
 * status). Thermal white-hot mode reserved for the WaveformBar.
 *
 * See:
 *   - `tokens.css` for the `--ac-*` palette + Google Fonts.
 *   - `theme.css` for surface classes (.ac-hud-frame, .ac-wire-button,
 *     .ac-bracket-tab, .ac-hud-text, .ac-thermal-bar).
 *   - `.claude/memory/decisions/ac130-thermal-design-language.md`
 *     for the full design language.
 *   - `web/public/reference/AC130-reference.JPEG` + `ac130-reference-2.jpg`
 *     for the source imagery.
 */
const manifest: ThemeManifest = {
  id: 'ac130-thermal',
  name: 'AC-130 Thermal',
  description: 'L3Harris HUD. Black void, neon green wire, scan lines, white-hot waveform.',
  shell,
  components: {
    DashboardShell,
    NavBar,
    ProfileDropdown,
    MTab,
    HTabPlaceholder,
    ETabPlaceholder,
    UTab,
    PlaybackControls,
    GearMenu,
    WaveformBar,
    SocialFeedRow,
  },
}

export default manifest
