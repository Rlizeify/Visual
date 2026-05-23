import { useTheme } from '../../themes/ThemeContext'

/**
 * EntertainmentTab — theme consumer. Renders the active theme's
 * ETabPlaceholder. The full AccountPage that previously lived here was
 * moved into the profile dropdown (PART 2). The pre-migration
 * AccountPage is preserved under web/src/archive/e-tab-account-stuff/.
 */
export default function EntertainmentTab() {
  const { theme } = useTheme()
  const ETabPlaceholder = theme.components.ETabPlaceholder
  return <ETabPlaceholder />
}
