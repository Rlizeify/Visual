/** VIDEO PREVIEW panel — playback + metadata display for selected video. */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useVideoStore } from './useVideoStore'
import type { VideoAnalysis } from './videoAnalyzer'

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Convert a local file path to a proper file:// URL. */
function toFileURL(filePath: string): string {
  // Normalize backslashes to forward slashes for Windows paths
  let normalized = filePath.replace(/\\/g, '/')
  // Ensure triple slash for absolute paths (e.g. C:/... -> file:///C:/...)
  if (!normalized.startsWith('/')) normalized = '/' + normalized
  return 'file://' + normalized
}

export default function VideoPreview() {
  const { selectedFile } = useVideoStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(0)
  const [prevVolume, setPrevVolume] = useState(0.7)
  const [isFullscreen, setIsFullscreen] = useState(false)

  /* Reset when file changes */
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setCurrentFrame(0)
    setMuted(true)
    setVolume(0)
    const v = videoRef.current
    if (v && selectedFile) {
      v.muted = true
      v.volume = 0
      v.load()
    }
  }, [selectedFile?.id])

  /* Listen for fullscreen changes */
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFSChange)
    return () => document.removeEventListener('fullscreenchange', handleFSChange)
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    const fps = selectedFile?.fps ?? 30
    setCurrentFrame(Math.floor(v.currentTime * fps))
  }, [selectedFile?.fps])

  const handleLoaded = useCallback(() => {
    const v = videoRef.current
    if (v) setDuration(v.duration)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v || !selectedFile) return
    if (v.paused) {
      v.play().catch(() => setPlaying(false))
    } else {
      v.pause()
    }
  }, [selectedFile])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (muted) {
      v.muted = false
      v.volume = prevVolume
      setMuted(false)
      setVolume(prevVolume)
    } else {
      setPrevVolume(volume > 0 ? volume : 0.7)
      v.muted = true
      v.volume = 0
      setMuted(true)
      setVolume(0)
    }
  }, [muted, volume, prevVolume])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    const val = Number(e.target.value)
    setVolume(val)
    v.volume = val
    if (val === 0) {
      v.muted = true
      setMuted(true)
    } else {
      v.muted = false
      setMuted(false)
      setPrevVolume(val)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (!document.fullscreenElement) {
      v.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  /* Tie playing state to actual video element events */
  const handlePlay = useCallback(() => setPlaying(true), [])
  const handlePause = useCallback(() => setPlaying(false), [])
  const handleEnded = useCallback(() => setPlaying(false), [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Number(e.target.value)
  }, [])

  if (!selectedFile) {
    return (
      <div className="vp-root">
        <span className="cockpit-panel__title">VIDEO PREVIEW</span>
        <div className="vp-empty">
          <span className="vp-empty__text">No video selected</span>
        </div>
      </div>
    )
  }

  const analysis: VideoAnalysis | undefined = selectedFile.analysis
  const analyzing = selectedFile.analyzing

  return (
    <div className="vp-root">
      <span className="cockpit-panel__title">VIDEO PREVIEW</span>

      {/* Video element */}
      <div className="vp-player">
        <video
          ref={videoRef}
          className="vp-video"
          src={toFileURL(selectedFile.path)}
          preload="metadata"
          muted
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoaded}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      </div>

      {/* Transport */}
      <div className="vp-transport">
        <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? 'II' : '\u25B6'}
        </button>
        <button className="vp-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
        </button>
        <input
          className="vp-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          title="Volume"
        />
        <span className="vp-time">{fmtTime(currentTime)}</span>
        <input
          className="vp-seek"
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          title="Seek position"
        />
        <span className="vp-time">{fmtTime(duration)}</span>
        <button className="vp-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? '\u2716' : '\u26F6'}
        </button>
      </div>

      {/* Metadata */}
      <div className="vp-meta">
        <div className="vp-meta__row">
          <span className="vp-meta__label">RES</span>
          <span className="vp-meta__value">{selectedFile.width}x{selectedFile.height} px</span>
        </div>
        <div className="vp-meta__row">
          <span className="vp-meta__label">FPS</span>
          <span className="vp-meta__value">{selectedFile.fps} Hz</span>
        </div>
        <div className="vp-meta__row">
          <span className="vp-meta__label">CODEC</span>
          <span className="vp-meta__value">{selectedFile.codec || 'unknown'}</span>
        </div>
        <div className="vp-meta__row">
          <span className="vp-meta__label">FRAME</span>
          <span className="vp-meta__value">{currentFrame}</span>
        </div>
      </div>

      {/* Analysis */}
      {analyzing && (
        <div className="vp-analysis">
          <span className="vp-analysis__loading">Analyzing...</span>
        </div>
      )}
      {analysis && !analyzing && (
        <div className="vp-analysis">
          <div className="vp-analysis__colors">
            <span className="vp-meta__label">COLORS</span>
            <div className="vp-analysis__swatches">
              {analysis.dominantColors.map((c, i) => (
                <div key={i} className="vp-analysis__swatch" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>
          <div className="vp-meta__row">
            <span className="vp-meta__label">BRIGHT</span>
            <span className="vp-meta__value">{Math.round(analysis.averageBrightness)}</span>
            <div className="vp-analysis__bar">
              <div className="vp-analysis__bar-fill" style={{ width: `${(analysis.averageBrightness / 255) * 100}%` }} />
            </div>
          </div>
          <div className="vp-meta__row">
            <span className="vp-meta__label">TEMP</span>
            <span className="vp-meta__value">{analysis.colorTemperature}</span>
          </div>
          <div className="vp-meta__row">
            <span className="vp-meta__label">MOTION</span>
            <span className="vp-meta__value">{analysis.motionIntensity}</span>
          </div>
          <div className="vp-meta__row">
            <span className="vp-meta__label">RATIO</span>
            <span className="vp-meta__value">{analysis.aspectRatio}</span>
          </div>
          <div className="vp-meta__row">
            <span className="vp-meta__label">AUDIO</span>
            <span className="vp-meta__value">{analysis.hasAudio ? 'yes' : 'no'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
