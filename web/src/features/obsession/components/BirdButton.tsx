// Fixed bird button. On click, navigates to /obsession/amor.
//
// The image lives at /reference/bird-reference.jpg (transparent PNG
// of a hummingbird). We use a button (not <a>) so React Router's
// useNavigate handles the transition without a full page load.

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
      <img src="/reference/bird-reference.jpg" alt="" />
    </button>
  )
}
