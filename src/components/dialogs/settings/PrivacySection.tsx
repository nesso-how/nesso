// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/i18n'

export function PrivacySection() {
  const t = useT()
  const telemetry = useGraphStore((s) => s.settings.telemetry)
  const setSetting = useGraphStore((s) => s.setSetting)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SettingsFormRow divider={false} label={t.settings.privacy.telemetry}>
        <Switch value={telemetry} onChange={(v) => setSetting('telemetry', v)} />
      </SettingsFormRow>
      <small
        style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 400,
          lineHeight: 1.5,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-4)',
          marginTop: -8,
        }}
      >
        {t.settings.privacy.telemetryDesc}
      </small>
      <small
        style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 400,
          lineHeight: 1.5,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-4)',
        }}
      >
        {t.settings.privacy.telemetryDetails}
      </small>
    </div>
  )
}
