/** VIDEO PREVIEW panel — playback + metadata display for selected video. */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useVideoStore } from './useVideoStore'

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

  /* Reset when file changes */
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setCurrentFrame(0)
    const v = videoRef.current
    if (v && selectedFile) {
      v.load()
    }
  }, [selectedFile?.id])

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

  return (
    <div className="vp-root">
      <span className="cockpit-panel__title">VIDEO PREVIEW</span>

      {/* Video element */}
      <div className="vp-player">
        <video
          ref={videoRef}
          className="vp-video"
          src={toFileURL(selectedFile.path)}
          preload="auto"
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
    </div>
  )
}
