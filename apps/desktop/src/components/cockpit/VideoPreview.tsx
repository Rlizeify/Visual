/** VIDEO PREVIEW panel — playback + metadata display for selected video. */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useVideoStore } from './useVideoStore'

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
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
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }, [selectedFile])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Number(e.target.value)
  }, [])

  const handleEnded = useCallback(() => setPlaying(false), [])

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
          src={`file://${selectedFile.path}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoaded}
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
