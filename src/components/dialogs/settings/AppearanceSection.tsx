// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'
import { useT } from '@/i18n'
import { SettingsHeatmapDefault } from '@/components/ui/HeatmapDisplayToggle'
import type { Language } from '@/types/graph'

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' },
]

export function AppearanceSection() {
  const t = useT()
  const dark = useGraphStore((s) => s.settings.dark)
  const language = useGraphStore((s) => s.settings.language)
  const edgeEncoding = useGraphStore((s) => s.settings.edgeEncoding)
  const curveStyle = useGraphStore((s) => s.settings.curveStyle)
  const autoCurveFlip = useGraphStore((s) => s.settings.autoCurveFlip)
  const setSetting = useGraphStore((s) => s.setSetting)

  return (
    <>
      <SettingsFormRow label={t.settings.appearance.theme}>
        <SegmentedControl
          options={[
            { id: 'light', label: t.settings.appearance.light },
            { id: 'dark', label: t.settings.appearance.dark },
          ]}
          value={dark ? 'dark' : 'light'}
          onChange={(v) => setSetting('dark', v === 'dark')}
        />
      </SettingsFormRow>

      <SettingsFormRow label={t.settings.appearance.language}>
        <Select
          options={LANGUAGES.map((lang) => ({ id: lang.id, label: lang.label }))}
          value={language}
          onChange={(id) => setSetting('language', id)}
        />
      </SettingsFormRow>

      {/* Graph display defaults — seed values for new graphs and graphs
          without their own stored display (mergeGraphDisplay / defaultGraphDisplay).
          The Sidebar still lets users override these per graph. */}
      <div style={{ marginBottom: 14 }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {t.settings.appearance.graphDefaults}
        </span>
        <small
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 400,
            lineHeight: 1.4,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-4)',
            marginTop: 6,
          }}
        >
          {t.settings.appearance.graphDefaultsDesc}
        </small>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SettingsHeatmapDefault />

        <SettingsFormRow divider={false} label={t.settings.appearance.edges}>
          <SegmentedControl
            options={[
              { id: 'full', label: t.settings.appearance.full },
              { id: 'category', label: t.settings.appearance.category },
              { id: 'minimal', label: t.settings.appearance.minimal },
            ]}
            value={edgeEncoding}
            onChange={(v) => setSetting('edgeEncoding', v as 'full' | 'category' | 'minimal')}
          />
        </SettingsFormRow>

        <SettingsFormRow divider={false} label={t.settings.appearance.curve}>
          <SegmentedControl
            options={[
              { id: 'arc', label: t.settings.appearance.arc },
              { id: 'straight', label: t.settings.appearance.straight },
            ]}
            value={curveStyle}
            onChange={(v) => setSetting('curveStyle', v as 'arc' | 'straight')}
          />
        </SettingsFormRow>

        {curveStyle === 'arc' && (
          <SettingsFormRow divider={false} label={t.settings.appearance.autoFlip}>
            <Switch value={autoCurveFlip} onChange={(v) => setSetting('autoCurveFlip', v)} />
          </SettingsFormRow>
        )}
      </div>
    </>
  )
}
