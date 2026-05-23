import type { ThemeManifest } from '../types'
import './tokens.css'
import shell from './shell'
import NullStub from './components/stubs'

/**
 * Asian Vibrant — stub theme. Activating this theme replaces the entire
 * UI with a "coming soon" placeholder via the shell. All per-surface
 * components return null because the shell ignores children.
 */
const manifest: ThemeManifest = {
  id: 'asian-vibrant',
  name: 'Asian Vibrant',
  description: 'Crimson + gold + sumi-e ink, anime cell-shading. Coming soon.',
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
