export type OscilloscopeMode = 'TIME' | 'XY' | 'XYZ'
export type CockpitAxisSource = 'bass' | 'mid' | 'high' | 'left' | 'right'
export type StudioAxisSource = 'wave0'|'wave1'|'wave2'|'wave3'|'wave4'|'wave5'|'wave6'|'wave7'|'auto'
export interface OscilloscopeDataProps {
  mode: OscilloscopeMode
  timeData?: Float32Array
  xData?: Float32Array
  yData?: Float32Array
  xData3?: Float32Array
  yData3?: Float32Array
  zData3?: Float32Array
  color?: string
  glowColor?: string
  showGrid?: boolean
  autoRotate?: boolean
  label?: string
}
