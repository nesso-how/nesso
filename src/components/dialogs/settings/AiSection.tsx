// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { useGraphStore } from '@/store'
import { ModelStatusBadge } from '@/components/mentor/ModelStatusBadge'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'
import { ExperimentalBadge } from '@/components/ui/ExperimentalBadge'
import { useT } from '@/i18n'
import {
  checkEndpoint,
  executeModelPull,
  isOllamaNative,
  listEndpointModels,
} from '@/llm/completion'
import { MENTOR_PERSONA_MAX_CHARS } from '@/llm/context'
import type { ModelStatus } from '@/lib/ollama'
import { isLocalhostUrl } from '@/lib/ollama'

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
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [pullProgress, setPullProgress] = useState(0)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [customModelOpen, setCustomModelOpen] = useState(false)
  // Whether the endpoint speaks the native Ollama API (`/api/version` probe).
  // null = not probed yet: Pull stays offered on loopback until the endpoint
  // positively proves otherwise, so starting a local Ollama mid-dialog keeps
  // working exactly as before.
  const [ollamaNative, setOllamaNative] = useState<boolean | null>(null)

  const healthCheckAbortRef = useRef<AbortController | null>(null)
  const modelsAbortRef = useRef<AbortController | null>(null)

  // Provider-agnostic model discovery: list the endpoint's own `/models`
  // inventory (Ollama and hosted providers alike) so the user picks a real
  // id instead of a hardcoded preset. Runs independently of the health check
  // above — notably it does not depend on the selected model, so typing or
  // selecting a model never refetches the list.
  useEffect(() => {
    if (!open || !mentorEnabled) {
      modelsAbortRef.current?.abort()
      setAvailableModels([])
      return
    }
    modelsAbortRef.current?.abort()
    const controller = new AbortController()
    modelsAbortRef.current = controller
    // The previous endpoint's ids stop being offered as soon as the URL or
    // key changes; the bare input below stays usable while loading.
    setAvailableModels([])
    setCustomModelOpen(false)
    void listEndpointModels(aiBaseUrl, aiApiKey, controller.signal).then((ids) => {
      if (controller.signal.aborted) return
      setAvailableModels(ids)
      // Default an empty model to the first discovered id so the select
      // never sits blank after entering a URL. A non-empty value — typed
      // or previously selected — is never overwritten; read it fresh so a
      // model typed while the fetch was in flight wins.
      if (ids.length > 0 && useGraphStore.getState().settings.aiModel === '') {
        setSetting('aiModel', ids[0])
      }
    })
    // Native Ollama probe for the Pull affordance: only a server that
    // positively answers `/api/version` is offered Pull. Unreachable keeps
    // the previous value (an Ollama started mid-dialog keeps working);
    // proven non-Ollama hides Pull.
    void isOllamaNative(aiBaseUrl, controller.signal).then((native) => {
      if (!controller.signal.aborted && native !== null) setOllamaNative(native)
    })
    return () => {
      controller.abort()
    }
  }, [open, aiBaseUrl, aiApiKey, mentorEnabled, setSetting])

  const pullAbortRef = useRef<AbortController | null>(null)
  /** Monotonic counter — bumped on each new pull or settings invalidation. */
  const pullRequestIdRef = useRef(0)

  const handlePull = useCallback(async () => {
    pullAbortRef.current?.abort()
    pullRequestIdRef.current += 1
    const requestId = pullRequestIdRef.current

    const controller = new AbortController()
    pullAbortRef.current = controller
    setModelStatus('pulling')
    setPullProgress(0)

    const guardedProgress = (fraction: number) => {
      if (pullRequestIdRef.current === requestId) setPullProgress(fraction)
    }

    const ok = await executeModelPull(aiBaseUrl, aiModel, controller.signal, guardedProgress)
    // Only update state if this is still the latest pull request AND not aborted.
    if (!controller.signal.aborted && pullRequestIdRef.current === requestId) {
      setModelStatus(ok ? 'available' : 'error')
    }
  }, [aiBaseUrl, aiModel])

  // Stop watching the pull stream when the dialog closes.
  useEffect(() => {
    if (!open) pullAbortRef.current?.abort()
  }, [open])

  useEffect(() => {
    if (!open || !mentorEnabled) {
      healthCheckAbortRef.current?.abort()
      pullAbortRef.current?.abort()
      pullRequestIdRef.current = 0
      setModelStatus('idle')
      return
    }
    // Settings changed while dialog is open and mentor is enabled — abort
    // any in-flight pull and invalidate stale requests so an old pull cannot
    // mark a freshly-selected model as available.
    pullAbortRef.current?.abort()
    pullRequestIdRef.current = 0

    const controller = new AbortController()
    // Abort any in-flight check from the previous effect invocation.
    healthCheckAbortRef.current?.abort()
    healthCheckAbortRef.current = controller
    setModelStatus('checking')
    checkEndpoint(aiBaseUrl, aiModel, aiApiKey, controller.signal)
      .then((s) => {
        if (!controller.signal.aborted) setModelStatus(s)
      })
      .catch(() => {
        if (!controller.signal.aborted) setModelStatus('error')
      })
    return () => {
      controller.abort()
    }
  }, [open, aiBaseUrl, aiModel, aiApiKey, mentorEnabled])

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
