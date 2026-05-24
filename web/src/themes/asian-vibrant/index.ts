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
 * Asian Vibrant — full theme.
 *
 * Classical East Asian scroll-painting aesthetic. Crimson lacquer
 * navigation, gold-leaf trim, rice-paper surfaces, sumi-e ink wash,
 * cherry-blossom drift, scrolling kanji columns, and a periodic dragon.
 *
 * See:
 *   - `tokens.css` for the palette + Google Fonts.
 *   - `theme.css` for surface classes (.av-paper-card, .av-scroll-panel,
 *     .av-title, ...).
 *   - `.claude/memory/decisions/asian-vibrant-design-language.md` for
 *     the full design language.
 */
const manifest: ThemeManifest = {
  id: 'asian-vibrant',
  name: 'Asian Vibrant',
  description: 'Crimson lacquer, gold leaf, rice paper, sumi-e ink, drifting petals.',
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
