import { play, pause, nextTrack, previousTrack, toggleShuffle } from '../../services/spotify/player'

interface Props {
  isPlaying: boolean
  shuffleState: boolean
  visible: boolean
}

export default function Controls({ isPlaying, shuffleState, visible }: Props) {
  return (
    <div className={`transport glass${visible ? '' : ' hud-hidden'}`} role="group" aria-label="Playback">
      <button type="button" className="transport__btn" onClick={previousTrack} aria-label="Previous track">Prev</button>
      <button type="button" className="transport__btn transport__btn--main" onClick={() => (isPlaying ? pause() : play())}
        aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button type="button" className="transport__btn" onClick={nextTrack} aria-label="Next track">Next</button>
      <button type="button" className="transport__btn" onClick={() => toggleShuffle(!shuffleState)}
        aria-label="Shuffle" aria-pressed={shuffleState}>
        Shuffle
      </button>
    </div>
  )
}
