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
      {/* TODO: re-exported PNG with alpha channel required at
          web/public/reference/bird-reference.png — current JPG has
          flattened transparency baked in. */}
      <img src="/reference/bird-reference.png" alt="" />
    </button>
  )
}
