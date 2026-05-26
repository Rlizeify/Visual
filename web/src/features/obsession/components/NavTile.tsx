// Bracketed nav tile on the Obsession landing.

import { Link } from 'react-router-dom'

interface Props {
  num: string
  name: string
  desc: string
  to: string
}

export default function NavTile({ num, name, desc, to }: Props) {
  return (
    <Link to={to} className="obs-tile">
      <div className="obs-tile-pip" />
      <div className="obs-tile-num">CH-{num}</div>
      <div className="obs-tile-name">[ {name} ]</div>
      <div className="obs-tile-desc">{desc}</div>
    </Link>
  )
}
