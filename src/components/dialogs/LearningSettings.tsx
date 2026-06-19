// SPDX-License-Identifier: MIT
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { Stepper } from '@/components/ui/Stepper'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'

export function LearningSettings() {
  const t = useT()
  const settings = useGraphStore((s) => s.settings)
  const setSetting = useGraphStore((s) => s.setSetting)

  return (
    <>
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
          {t.settings.learning.review}
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
          {t.settings.learning.reviewDesc}
        </small>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SettingsFormRow
          divider={false}
          label={t.settings.learning.reviewMode}
          description={t.settings.learning.reviewModeDesc}
        >
          <Switch value={settings.reviewEnabled} onChange={(v) => setSetting('reviewEnabled', v)} />
        </SettingsFormRow>

        {settings.reviewEnabled && (
          <>
            <SettingsFormRow
              divider={false}
              label={t.settings.learning.retention}
              description={t.settings.learning.retentionDesc}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
                <input
                  type="range"
                  className="settings-slider"
                  min={70}
                  max={97}
                  step={1}
                  value={Math.round(settings.fsrsRetention * 100)}
                  onChange={(e) => setSetting('fsrsRetention', Number(e.target.value) / 100)}
                  style={{
                    width: 110,
                    background: (() => {
                      const pct = ((Math.round(settings.fsrsRetention * 100) - 70) / 27) * 100
                      return `linear-gradient(to right, var(--ink-2) ${pct}%, var(--line-strong) ${pct}%)`
                    })(),
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--ink-2)',
                    minWidth: 32,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(settings.fsrsRetention * 100)}%
                </span>
              </div>
            </SettingsFormRow>

            <SettingsFormRow
              divider={false}
              label={t.settings.learning.maxInterval}
              description={t.settings.learning.maxIntervalDesc}
            >
              <Stepper
                value={settings.maximumInterval}
                min={1}
                max={36500}
                onChange={(v) => setSetting('maximumInterval', v)}
              />
            </SettingsFormRow>
          </>
        )}
      </div>
    </>
  )
}
