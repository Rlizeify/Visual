import { useState } from 'react'

interface ToggleSwitchProps {
  label: string
  defaultOn?: boolean
  onChange?: (on: boolean) => void
}

export default function ToggleSwitch({ label, defaultOn = false, onChange }: ToggleSwitchProps) {
  const [on, setOn] = useState(defaultOn)

  const handleClick = () => {
    const next = !on
    setOn(next)
    onChange?.(next)
  }

  return (
    <div
      className={`toggle-wrap ${on ? 'active' : ''}`}
      onClick={handleClick}
      title={`${label}: ${on ? 'ON' : 'OFF'}`}
    >
      <div className="toggle-switch">
        <div className={`toggle-switch__lever ${on ? 'on' : 'off'}`} />
        <div className={`toggle-switch__indicator ${on ? 'on' : 'off'}`} />
      </div>
      <span className="toggle-label">{label}</span>
    </div>
  )
}
