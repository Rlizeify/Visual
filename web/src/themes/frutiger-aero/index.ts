import type { ThemeManifest } from '../types'
import './tokens.css'

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

const manifest: ThemeManifest = {
  id: 'frutiger-aero',
  name: 'Frutiger Aero',
  description: 'Glassy navy + per-user accent. The original MHEU look.',
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
