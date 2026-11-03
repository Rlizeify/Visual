import type { ThemeManifest } from '../types'
import './tokens.css'

import shell from './shell'
import DashboardShell from './components/DashboardShell'
import NavBar from './components/NavBar'
import ProfileDropdown from './components/ProfileDropdown'
import MTab from './components/MTab'
import HTabPlaceholder from './components/HTabPlaceholder'
import ETabPlaceholder from './components/ETabPlaceholder'
import PlaybackControls from './components/PlaybackControls'
import GearMenu from './components/GearMenu'
import WaveformBar from './components/WaveformBar'

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
    PlaybackControls,
    GearMenu,
    WaveformBar,
  },
}

export default manifest
