import type { ThemeManifest } from './types'
import frutigerAero from './frutiger-aero'
import asianVibrant from './asian-vibrant'
import ac130Thermal from './ac130-thermal'

/**
 * The theme registry. Add a new theme by importing its manifest here
 * and adding it to the `themes` map. The order of keys determines the
 * order in the theme switcher.
 */
export const themes: Record<string, ThemeManifest> = {
  [frutigerAero.id]: frutigerAero,
  [asianVibrant.id]: asianVibrant,
  [ac130Thermal.id]: ac130Thermal,
}

export const DEFAULT_THEME_ID = frutigerAero.id
