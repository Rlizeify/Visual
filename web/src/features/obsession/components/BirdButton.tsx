// Fixed bird button. On click, navigates to /obsession/amor.
//
// We use a button (not <a>) so React Router's useNavigate handles the
// transition without a full page load.

import { useNavigate } from 'react-router-dom'

export default function BirdButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="obs-bird"
      onClick={() => navigate('/obsession/amor')}
      aria-label="Cantus Avium"
      title="Cantus Avium"
    >
      {/* Until Stone re-exports a PNG-24 with alpha channel, reference
          the JPG that actually ships in public/reference/. The .png path
          404'd in production — broken-image icon + drop-shadow halo read
          as an "empty bordered box" beside the BR HUD corner. */}
      <img src="/reference/bird-reference.jpg" alt="" />
    </button>
  )
}
