// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { Switch } from '@/components/ui/Switch'
import { SettingRow } from '@/components/ui/SettingRow'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { useT } from '@/i18n'

/** Per-graph heatmap toggle in the sidebar Display section; hidden when review mode is off. */
export function SidebarHeatmapToggle() {
  const t = useT()
  const reviewEnabled = useGraphStore((s) => s.settings.reviewEnabled)
  const showHeatmap = useGraphStore((s) => s.graphDisplay.showHeatmap)
  const setGraphDisplay = useGraphStore((s) => s.setGraphDisplay)
  if (!reviewEnabled) return null
  return (
    <SettingRow label={t.sidebar.displayOptions.heatmap}>
      <Switch value={showHeatmap} onChange={(v) => setGraphDisplay('showHeatmap', v)} />
    </SettingRow>
  )
}

/** App-default heatmap toggle in Settings → Appearance; hidden when review mode is off. */
export function SettingsHeatmapDefault() {
  const t = useT()
  const reviewEnabled = useGraphStore((s) => s.settings.reviewEnabled)
  const showHeatmap = useGraphStore((s) => s.settings.showHeatmap)
  const setSetting = useGraphStore((s) => s.setSetting)
  if (!reviewEnabled) return null
  return (
    <SettingsFormRow divider={false} label={t.settings.appearance.heatmap}>
      <Switch value={showHeatmap} onChange={(v) => setSetting('showHeatmap', v)} />
    </SettingsFormRow>
  )
}
