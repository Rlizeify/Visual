import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar from './TopBar'
import LeftPanel from './LeftPanel'
import CenterPanel from './CenterPanel'
import RightPanel from './RightPanel'
import BottomBar from './BottomBar'
import WaveformPanel from './WaveformPanel'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { Tooltip, Oscilloscope } from '../shared'

type OscMode = 'TIME' | 'XY' | 'XYZ'
type CockpitAxisSource = 'bass' | 'mid' | 'high' | 'left' | 'right'

export default function CockpitApp() {
  const audio = useAudioEngine()

  const [oscMode, setOscMode] = useState<OscMode>('TIME')
  const [xyzSources, setXyzSources] = useState<{ x: CockpitAxisSource; y: CockpitAxisSource; z: CockpitAxisSource }>({
    x: 'bass', y: 'mid', z: 'high',
  })

  const timeDomainRef = useRef<Float32Array>(new Float32Array(256))
  const leftRef = useRef<Float32Array>(new Float32Array(256))
  const rightRef = useRef<Float32Array>(new Float32Array(256))
  const bassRef = useRef<Float32Array>(new Float32Array(256))
  const midRef = useRef<Float32Array>(new Float32Array(256))
  const highRef = useRef<Float32Array>(new Float32Array(256))
  const [frameCounter, setFrameCounter] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      if (audio.isLoaded || audio.isPlaying) {
        timeDomainRef.current = audio.getTimeDomainData()
        leftRef.current = audio.getLeftChannelData()
        rightRef.current = audio.getRightChannelData()
        bassRef.current = audio.getBandTimeDomain('bass')
        midRef.current = audio.getBandTimeDomain('mid')
        highRef.current = audio.getBandTimeDomain('high')
        setFrameCounter(c => c + 1)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [audio.isLoaded, audio.isPlaying])

  const getBandRef = useCallback((source: CockpitAxisSource): Float32Array => {
    switch (source) {
      case 'bass': return bassRef.current
      case 'mid': return midRef.current
      case 'high': return highRef.current
      case 'left': return leftRef.current
      case 'right': return rightRef.current
    }
  }, [frameCounter])

  const sourceLabel = (s: CockpitAxisSource) => {
    switch (s) {
      case 'bass': return 'bass'
      case 'mid': return 'mid hz'
      case 'high': return 'high hz'
      case 'left': return 'L ch'
      case 'right': return 'R ch'
    }
  }

  const handleLoad = async () => {
    const filepath = await window.api?.loadMp3()
    if (filepath) await audio.load(filepath)
  }

  const sourceOptions: CockpitAxisSource[] = ['bass', 'mid', 'high', 'left', 'right']

  const oscilloscopePanel = (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Mode bar */}
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
        borderBottom: '1px solid rgba(255,176,0,0.15)',
      }}>
        {(['TIME', 'XY', 'XYZ'] as OscMode[]).map(mode => (
          <Tooltip
            key={mode}
            text={`${mode} MODE`}
            detail={
              mode === 'TIME' ? 'Classic oscilloscope — plots audio amplitude over time' :
              mode === 'XY' ? 'Lissajous figure — left channel vs right channel. Shows stereo width.' :
              '3D Lissajous — assign frequency bands to axes. Drag canvas to rotate.'
            }
          >
            <button
              onClick={() => setOscMode(mode)}
              style={{
                fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700,
                padding: '2px 10px', border: '1px solid',
                borderColor: oscMode === mode ? '#ffb000' : 'rgba(255,176,0,0.3)',
                background: oscMode === mode ? 'rgba(255,176,0,0.2)' : 'transparent',
                color: oscMode === mode ? '#ffb000' : 'rgba(255,176,0,0.5)',
                cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
              }}
            >
              {mode}
            </button>
          </Tooltip>
        ))}

        {oscMode === 'XYZ' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 12, alignItems: 'center' }}>
            {(['x', 'y', 'z'] as const).map(axis => (
              <label key={axis} style={{
                fontFamily: 'Orbitron, monospace', fontSize: 9, color: '#ffb000', display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <span style={{ color: axis === 'x' ? '#ff4444' : axis === 'y' ? '#44ff44' : '#4488ff' }}>
                  {axis.toUpperCase()}
                </span>
                <select
                  value={xyzSources[axis]}
                  onChange={e => setXyzSources(prev => ({ ...prev, [axis]: e.target.value as CockpitAxisSource }))}
                  style={{
                    fontFamily: 'Orbitron, monospace', fontSize: 9, background: '#0a0a0a',
                    color: '#ffb000', border: '1px solid rgba(255,176,0,0.3)', padding: '1px 4px',
                    borderRadius: 2, outline: 'none',
                  }}
                >
                  {sourceOptions.map(opt => (
                    <option key={opt} value={opt}>{sourceLabel(opt)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Oscilloscope */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Oscilloscope
          mode={oscMode}
          timeData={oscMode === 'TIME' ? timeDomainRef.current : undefined}
          xData={oscMode === 'XY' ? leftRef.current : undefined}
          yData={oscMode === 'XY' ? rightRef.current : undefined}
          xData3={oscMode === 'XYZ' ? getBandRef(xyzSources.x) : undefined}
          yData3={oscMode === 'XYZ' ? getBandRef(xyzSources.y) : undefined}
          zData3={oscMode === 'XYZ' ? getBandRef(xyzSources.z) : undefined}
          color="#00ffcc"
          glowColor="rgba(0,255,204,0.35)"
          showGrid={true}
          autoRotate={oscMode === 'XYZ'}
          onModeChange={(m: OscMode) => setOscMode(m)}
        />
      </div>
    </div>
  )

  return (
    <div className="cockpit-frame">
      <TopBar trackName={audio.filename || ''} />

      <div className="cockpit-body">
        <LeftPanel bass={audio.bass} mid={audio.mid} high={audio.high} />
        <CenterPanel
          isPlaying={audio.isPlaying}
          isLoaded={audio.isLoaded}
          currentTime={audio.currentTime}
          duration={audio.duration}
          bpm={audio.bpm}
          detectedKey={audio.detectedKey}
          onLoad={handleLoad}
          onPlay={audio.play}
          onPause={audio.pause}
          onStop={audio.stop}
          onSeek={audio.seek}
          waveformSlot={oscilloscopePanel}
        />
        <RightPanel
          onSpeedChange={audio.setSpeed}
          onWeightChange={audio.setWeight}
          onTextureChange={audio.setTexture}
          onBrightnessChange={audio.setBrightness}
          onBassBoostChange={audio.setBassBoost}
          onBeatSyncChange={audio.setBeatSync}
          onVinylSimChange={audio.setVinylSim}
          onStereoWideChange={audio.setStereoWide}
          onNightModeChange={audio.setNightMode}
          onPushDisplayChange={audio.setPushDisplay}
        />
      </div>

      <BottomBar fileName={audio.filename || ''} duration={audio.duration} onMasterVolume={audio.setMasterVolume} />
    </div>
  )
}
