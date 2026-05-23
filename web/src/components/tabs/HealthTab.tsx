import { useTheme } from '../../themes/ThemeContext'

export default function HealthTab() {
  const { theme } = useTheme()
  const HTabPlaceholder = theme.components.HTabPlaceholder
  return <HTabPlaceholder />
}
