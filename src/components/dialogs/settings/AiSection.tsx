// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { ModelStatusBadge } from '@/components/mentor/ModelStatusBadge'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'
import { ExperimentalBadge } from '@/components/ui/ExperimentalBadge'
import { useT } from '@/i18n'
import { isLocalhostUrl } from '@/lib/ollama'
import { MENTOR_PERSONA_MAX_CHARS } from '@/llm/context'
import { useModelDiscovery } from './ai/useModelDiscovery'
import { useModelPull } from './ai/useModelPull'
import { useEndpointHealthCheck } from './ai/useEndpointHealthCheck'

/**
 * Pseudo-option id inside the model select that reveals the free-text input
 * instead of picking a model. Never stored in settings, never health-checked:
 * the onChange handler intercepts it before setSetting.
 */
const CUSTOM_MODEL_OPTION_ID = '__nesso_custom__'

export function AiSection({ open }: { open: boolean }) {
  const t = useT()
  const mentorEnabled = useGraphStore((s) => s.settings.mentorEnabled)
  const aiBaseUrl = useGraphStore((s) => s.settings.aiBaseUrl)
  const aiModel = useGraphStore((s) => s.settings.aiModel)
  const aiApiKey = useGraphStore((s) => s.settings.aiApiKey)
  const mentorSystemPrompt = useGraphStore((s) => s.settings.mentorSystemPrompt)
  const setSetting = useGraphStore((s) => s.setSetting)

  // Async lifecycles, split by ownership: discovery, pull, and health check
  // each own their abort state exclusively. The only cross-lifecycle
  // coordination is `invalidatePull`, which lets the health check retire a
  // stale pull without touching the pull's refs. Hook order preserves the
  // original effect order (discovery → pull → health check).
  const { availableModels, customModelOpen, setCustomModelOpen, ollamaNative } = useModelDiscovery({
    open,
    mentorEnabled,
    aiBaseUrl,
    aiApiKey,
    setSetting,
  })
  const { modelStatus, setModelStatus, pullProgress, handlePull, invalidatePull } = useModelPull({
    open,
    aiBaseUrl,
    aiModel,
  })
  useEndpointHealthCheck({
    open,
    mentorEnabled,
    aiBaseUrl,
    aiModel,
    aiApiKey,
    setModelStatus,
    invalidatePull,
  })

  // The free-text input stays visible when there is no discovered list, when
  // the user explicitly opened it, or when the current value is custom
  // (typed, e.g. a model to pull that is not listed yet). Otherwise the
  // select alone is the control and the input hides behind its toggle.
  const showModelInput =
    availableModels.length === 0 ||
    customModelOpen ||
    (aiModel !== '' && !availableModels.includes(aiModel))

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'none',
    border: '0.5px solid var(--line)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    background: 'var(--paper-deep)',
    color: 'var(--ink)',
    fontSize: '13px',
    fontWeight: 400,
    fontFamily: 'var(--font-mono)',
  }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            {t.settings.ai.mentor}
          </span>
          <ExperimentalBadge />
        </div>
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
          {t.settings.ai.mentorDesc}
        </small>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SettingsFormRow
          divider={false}
          label={t.settings.ai.mentorMode}
          description={t.settings.ai.mentorModeDesc}
        >
          <Switch value={mentorEnabled} onChange={(v) => setSetting('mentorEnabled', v)} />
        </SettingsFormRow>

        {mentorEnabled && (
          <>
            <label style={{ display: 'block' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-2)',
                  display: 'block',
                }}
              >
                {t.settings.ai.apiBaseUrl}
              </span>
              <small
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 400,
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                  marginTop: 3,
                  marginBottom: 8,
                }}
              >
                {t.settings.ai.apiBaseUrlDesc}
              </small>
              <input
                type="text"
                value={aiBaseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={(e) => setSetting('aiBaseUrl', e.target.value)}
                style={inputStyle}
              />
            </label>

            <div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-2)',
                  display: 'block',
                }}
              >
                {t.settings.ai.model}
              </span>
              <small
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 400,
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                  marginTop: 3,
                  marginBottom: 10,
                }}
              >
                {t.settings.ai.modelDesc}
              </small>
              {availableModels.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <Select
                    options={[
                      ...(availableModels.includes(aiModel) || aiModel === ''
                        ? availableModels
                        : [aiModel, ...availableModels]
                      ).map((id) => ({ id, label: id })),
                      { id: CUSTOM_MODEL_OPTION_ID, label: t.settings.ai.customModel },
                    ]}
                    value={aiModel}
                    onChange={(id) => {
                      if (id === CUSTOM_MODEL_OPTION_ID) {
                        // Reveal the free-text input without touching
                        // the stored model; picking a discovered id
                        // below closes it again.
                        setCustomModelOpen(true)
                        return
                      }
                      setSetting('aiModel', id)
                      setCustomModelOpen(false)
                    }}
                  />
                </div>
              )}
              {showModelInput && (
                <input
                  type="text"
                  value={aiModel}
                  placeholder="e.g. qwen3.5:9b"
                  onChange={(e) => {
                    setSetting('aiModel', e.target.value)
                    setModelStatus('idle')
                  }}
                  style={inputStyle}
                />
              )}
              <ModelStatusBadge
                status={modelStatus}
                model={aiModel}
                baseUrl={aiBaseUrl}
                pullProgress={pullProgress}
                canPull={isLocalhostUrl(aiBaseUrl) && ollamaNative !== false}
                onPull={() => void handlePull()}
              />
            </div>

            <label style={{ display: 'block' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-2)',
                  display: 'block',
                }}
              >
                {t.settings.ai.apiKey}
              </span>
              <small
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 400,
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                  marginTop: 3,
                  marginBottom: 8,
                }}
              >
                {t.settings.ai.apiKeyDesc}{' '}
                <code
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace",
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  Authorization: Bearer
                </code>
                .
              </small>
              <input
                type="password"
                autoComplete="off"
                value={aiApiKey}
                placeholder="••••••••"
                onChange={(e) => setSetting('aiApiKey', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-2)',
                  display: 'block',
                }}
              >
                {t.settings.ai.systemPrompt}
              </span>
              <small
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 400,
                  lineHeight: 1.4,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                  marginTop: 3,
                  marginBottom: 8,
                }}
              >
                {t.settings.ai.systemPromptDesc}
              </small>
              <textarea
                value={mentorSystemPrompt}
                placeholder={t.settings.ai.systemPromptPlaceholder}
                maxLength={MENTOR_PERSONA_MAX_CHARS}
                onChange={(e) => setSetting('mentorSystemPrompt', e.target.value)}
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 96,
                  lineHeight: 1.45,
                }}
              />
            </label>
          </>
        )}
      </div>
    </>
  )
}
