import { useState } from 'react'

interface ToggleSwitchProps {
  label: string
  defaultOn?: boolean
}

export default function ToggleSwitch({ label, defaultOn = false }: ToggleSwitchProps) {
  const [on, setOn] = useState(defaultOn)

  return (
    <div
      className={`toggle-wrap ${on ? 'active' : ''}`}
      onClick={() => setOn((v) => !v)}
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
