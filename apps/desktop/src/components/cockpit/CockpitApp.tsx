import { useState } from 'react'
import TopBar from './TopBar'
import LeftPanel from './LeftPanel'
import CenterPanel from './CenterPanel'
import RightPanel from './RightPanel'
import BottomBar from './BottomBar'

export default function CockpitApp() {
  const [trackName, setTrackName] = useState('')

  return (
    <div className="cockpit-frame">
      <TopBar trackName={trackName} />

      <div className="cockpit-body">
        <LeftPanel />
        <CenterPanel onTrackLoaded={setTrackName} />
        <RightPanel />
      </div>

      <BottomBar fileName={trackName} />
    </div>
  )
}
