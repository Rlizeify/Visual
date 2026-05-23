import type { ThemeManifest } from '../types'
import './tokens.css'
import shell from './shell'
import NullStub from './components/stubs'

/**
 * AC-130 Thermal — stub theme. Whole UI replaced by a thermal-camera
 * placeholder via the shell. Per-surface components return null.
 */
const manifest: ThemeManifest = {
  id: 'ac130-thermal',
  name: 'AC-130 Thermal',
  description: 'White-hot FLIR. Mono-luminance, brackets, scan lines. Coming soon.',
  shell,
  components: {
    DashboardShell: NullStub,
    NavBar: NullStub,
    ProfileDropdown: NullStub,
    MTab: NullStub,
    HTabPlaceholder: NullStub,
    ETabPlaceholder: NullStub,
    UTab: NullStub,
    PlaybackControls: NullStub,
    GearMenu: NullStub,
    WaveformBar: NullStub,
    SocialFeedRow: NullStub,
  },
}

export default manifest
