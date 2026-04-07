import VideoFiles from './VideoFiles'
import VideoPreview from './VideoPreview'
import VisualizerControls from './VisualizerControls'
import VisualizerPreview from './VisualizerPreview'
import SpotifyBrowser from './SpotifyBrowser'
import SpotifyConnect from './SpotifySettings'

interface VisualizerState {
  selectedPreset: string; blendTime: number; cycleSpeed: number
  bassReactivity: number; midReactivity: number; highReactivity: number; animationSpeed: number
}

interface VisualizerHandlers {
  onPresetChange: (v: string) => void; onBlendTime: (v: number) => void; onCycleSpeed: (v: number) => void
  onBass: (v: number) => void; onMid: (v: number) => void; onHigh: (v: number) => void; onAnimationSpeed: (v: number) => void
}

interface Props {
  topLeftTab: 'video' | 'spotify'
  onSetTopLeftTab: (t: 'video' | 'spotify') => void
  onSpotifyConnected: (token: string) => void
  viz: VisualizerState
  handlers: VisualizerHandlers
  analyser: AnalyserNode | null
  activeSource: 'mp3' | 'spotify'
}

export default function CockpitGrid({ topLeftTab, onSetTopLeftTab, onSpotifyConnected, viz, handlers, analyser, activeSource }: Props) {
  return (
    <div className="cockpit-main" data-tutorial-id="cockpit-grid">
      <div className="cockpit-panel" data-tutorial-id="video-files">
        <div className="sp-tab-bar">
          <button className={`sp-tab${topLeftTab === 'video' ? ' sp-tab--active' : ''}`} onClick={() => onSetTopLeftTab('video')}>VIDEO</button>
          <button className={`sp-tab${topLeftTab === 'spotify' ? ' sp-tab--active' : ''}`} onClick={() => onSetTopLeftTab('spotify')}>SPOTIFY</button>
        </div>
        {topLeftTab === 'video' ? <VideoFiles /> : (
          <>
            <SpotifyConnect onConnected={onSpotifyConnected} />
            <SpotifyBrowser />
          </>
        )}
      </div>
      <div className="cockpit-panel" data-tutorial-id="video-preview"><VideoPreview /></div>
      <div className="cockpit-panel" data-tutorial-id="visualizer-controls">
        <span className="cockpit-panel__title">VISUALIZER</span>
        <VisualizerControls
          selectedPreset={viz.selectedPreset} blendTime={viz.blendTime} cycleSpeed={viz.cycleSpeed}
          bassReactivity={viz.bassReactivity} midReactivity={viz.midReactivity} highReactivity={viz.highReactivity}
          animationSpeed={viz.animationSpeed}
          onPresetChange={handlers.onPresetChange} onBlendTime={handlers.onBlendTime} onCycleSpeed={handlers.onCycleSpeed}
          onBass={handlers.onBass} onMid={handlers.onMid} onHigh={handlers.onHigh} onAnimationSpeed={handlers.onAnimationSpeed}
        />
      </div>
      <div className="cockpit-panel" data-tutorial-id="visualizer-preview" style={{ position: 'relative' }}>
        <VisualizerPreview analyser={analyser} selectedPreset={viz.selectedPreset}
          blendTime={viz.blendTime} cycleSpeed={viz.cycleSpeed} animationSpeed={viz.animationSpeed} />
        {activeSource === 'spotify' && <span className="sp-badge">♫ SPOTIFY</span>}
      </div>
    </div>
  )
}
