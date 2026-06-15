// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { useGraphStore } from '@/store'
import { useWebLLM } from '@/llm/webllm'
import { CloseButton } from '@/components/ui/CloseButton'
import { LocalModelPanel } from '@/components/mentor/LocalModelPanel'
import { ModelStatusBadge } from '@/components/mentor/ModelStatusBadge'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'
import { Stepper } from '@/components/ui/Stepper'
import { useT } from '@/i18n'
import type { Language } from '@/types/graph'
import { checkOllamaModel, streamOllamaModelPull, type OllamaModelStatus } from '@/lib/ollama'

const OLLAMA_PRESETS = [
  { id: 'gemma3:4b', note: 'balanced · recommended' },
  { id: 'llama3.2:3b', note: 'lightweight · fast' },
  { id: 'qwen2.5:7b', note: 'precise · best reasoning' },
] as const

type Tab = 'appearance' | 'ai' | 'review'
const ALL_TABS = ['appearance', 'ai', 'review'] as const

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('appearance')
  const settings = useGraphStore((s) => s.settings)
  const setSetting = useGraphStore((s) => s.setSetting)
  const llm = useWebLLM()
  const [modelStatus, setModelStatus] = useState<OllamaModelStatus>('idle')
  const [pullProgress, setPullProgress] = useState(0)

  const triggerCheck = useCallback((baseUrl: string, model: string) => {
    if (!model) {
      setModelStatus('idle')
      return
    }
    setModelStatus('checking')
    checkOllamaModel(baseUrl, model)
      .then((s) => setModelStatus(s))
      .catch(() => setModelStatus('error'))
  }, [])

  const pullAbortRef = useRef<AbortController | null>(null)

  const handlePull = useCallback(async () => {
    pullAbortRef.current?.abort()
    const controller = new AbortController()
    pullAbortRef.current = controller
    setModelStatus('pulling')
    setPullProgress(0)
    try {
      for await (const p of streamOllamaModelPull(
        settings.aiBaseUrl,
        settings.aiModel,
        controller.signal,
      )) {
        setPullProgress(p)
      }
      setModelStatus('available')
    } catch {
      if (!controller.signal.aborted) setModelStatus('error')
    }
  }, [settings.aiBaseUrl, settings.aiModel])

  // Stop watching the pull stream when the dialog closes.
  useEffect(() => {
    if (!open) pullAbortRef.current?.abort()
  }, [open])

  useEffect(() => {
    if (!open || settings.aiMode !== 'remote') {
      setModelStatus('idle')
      return
    }
    let cancelled = false
    setModelStatus('checking')
    checkOllamaModel(settings.aiBaseUrl, settings.aiModel)
      .then((s) => {
        if (!cancelled) setModelStatus(s)
      })
      .catch(() => {
        if (!cancelled) setModelStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, settings.aiMode, settings.aiBaseUrl])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'none',
    border: '0.5px solid var(--line)',
    borderRadius: 6,
    padding: '10px 12px',
    background: 'var(--paper-deep)',
    color: 'var(--ink)',
    font: "400 13px 'JetBrains Mono', ui-monospace",
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          <CloseButton large onClick={onClose} />
        </div>
        <div
          style={{
            width: 660,
            maxWidth: '94vw',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            overflow: 'hidden',
            minHeight: 340,
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              width: 156,
              flexShrink: 0,
              borderRight: '0.5px solid var(--line)',
              background: 'var(--bg-elev)',
              padding: '20px 12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div
              style={{
                font: "500 10px 'JetBrains Mono', ui-monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--ink-4)',
                padding: '0 8px',
                marginBottom: 10,
              }}
            >
              {t.settings.title}
            </div>
            {ALL_TABS.map((tabId) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: tab === tabId ? 'var(--paper-deep)' : 'transparent',
                  color: tab === tabId ? 'var(--ink)' : 'var(--ink-3)',
                  font: `${tab === tabId ? '500' : '400'} 13px 'Inter', system-ui`,
                  textAlign: 'left',
                  padding: '7px 10px',
                  borderRadius: 8,
                  cursor: 'default',
                  transition: 'all 0.12s',
                  width: '100%',
                }}
              >
                {t.settings.tabs[tabId]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div
            className="nesso-scrollbar"
            style={{ flex: 1, padding: '24px 28px 24px', overflowY: 'auto', minWidth: 0 }}
          >
            <div
              style={{
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '0.5px solid var(--line)',
              }}
            >
              <span style={{ font: "500 14px 'Inter', system-ui", color: 'var(--ink)' }}>
                {t.settings.tabs[tab]}
              </span>
            </div>

            {tab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                    {t.settings.appearance.theme}
                  </span>
                  <SegmentedControl
                    options={[
                      { id: 'light', label: t.settings.appearance.light },
                      { id: 'dark', label: t.settings.appearance.dark },
                    ]}
                    value={settings.dark ? 'dark' : 'light'}
                    onChange={(v) => setSetting('dark', v === 'dark')}
                  />
                </div>

                <div
                  style={{
                    borderTop: '0.5px solid var(--line)',
                    paddingTop: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                    {t.settings.appearance.language}
                  </span>
                  <Select
                    options={LANGUAGES.map((lang) => ({ id: lang.id, label: lang.label }))}
                    value={settings.language}
                    onChange={(id) => setSetting('language', id)}
                  />
                </div>

                {/* Graph display defaults — seed values for new graphs and graphs
                    without their own stored display (mergeGraphDisplay / defaultGraphDisplay).
                    The Sidebar still lets users override these per graph. */}
                <div style={{ borderTop: '0.5px solid var(--line)', paddingTop: 18 }}>
                  <div style={{ marginBottom: 14 }}>
                    <span
                      style={{
                        font: "500 11px 'JetBrains Mono', ui-monospace",
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
                        font: "400 11px/1.4 'Inter', system-ui",
                        color: 'var(--ink-4)',
                        marginTop: 6,
                      }}
                    >
                      {t.settings.appearance.graphDefaultsDesc}
                    </small>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                        {t.settings.appearance.heatmap}
                      </span>
                      <Switch
                        value={settings.showHeatmap}
                        onChange={(v) => setSetting('showHeatmap', v)}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                        {t.settings.appearance.edges}
                      </span>
                      <SegmentedControl
                        options={[
                          { id: 'full', label: t.settings.appearance.full },
                          { id: 'category', label: t.settings.appearance.category },
                          { id: 'minimal', label: t.settings.appearance.minimal },
                        ]}
                        value={settings.edgeEncoding}
                        onChange={(v) =>
                          setSetting('edgeEncoding', v as 'full' | 'category' | 'minimal')
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                        {t.settings.appearance.curve}
                      </span>
                      <SegmentedControl
                        options={[
                          { id: 'arc', label: t.settings.appearance.arc },
                          { id: 'straight', label: t.settings.appearance.straight },
                        ]}
                        value={settings.curveStyle}
                        onChange={(v) => setSetting('curveStyle', v as 'arc' | 'straight')}
                      />
                    </div>

                    {settings.curveStyle === 'arc' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}
                        >
                          {t.settings.appearance.autoFlip}
                        </span>
                        <Switch
                          value={settings.autoCurveFlip}
                          onChange={(v) => setSetting('autoCurveFlip', v)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Mode selector — same pattern as Light / Dark in Appearance */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                    {t.settings.ai.source}
                  </span>
                  <SegmentedControl
                    options={[
                      { id: 'local', label: t.settings.ai.local },
                      { id: 'remote', label: t.settings.ai.remote },
                    ]}
                    value={settings.aiMode}
                    onChange={(v) => setSetting('aiMode', v as 'local' | 'remote')}
                  />
                </div>

                {/* Config area */}
                <div style={{ borderTop: '0.5px solid var(--line)', paddingTop: 18 }}>
                  {settings.aiMode === 'remote' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <label style={{ display: 'block' }}>
                        <span
                          style={{
                            font: "400 13px 'Inter', system-ui",
                            color: 'var(--ink-2)',
                            display: 'block',
                          }}
                        >
                          {t.settings.ai.apiBaseUrl}
                        </span>
                        <small
                          style={{
                            display: 'block',
                            font: "400 11px/1.4 'Inter', system-ui",
                            color: 'var(--ink-4)',
                            marginTop: 3,
                            marginBottom: 8,
                          }}
                        >
                          {t.settings.ai.apiBaseUrlDesc}
                        </small>
                        <input
                          type="text"
                          value={settings.aiBaseUrl}
                          placeholder="http://localhost:11434/v1"
                          onChange={(e) => setSetting('aiBaseUrl', e.target.value)}
                          style={inputStyle}
                        />
                      </label>

                      <div>
                        <span
                          style={{
                            font: "400 13px 'Inter', system-ui",
                            color: 'var(--ink-2)',
                            display: 'block',
                          }}
                        >
                          {t.settings.ai.model}
                        </span>
                        <small
                          style={{
                            display: 'block',
                            font: "400 11px/1.4 'Inter', system-ui",
                            color: 'var(--ink-4)',
                            marginTop: 3,
                            marginBottom: 10,
                          }}
                        >
                          {t.settings.ai.modelDesc}
                        </small>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginBottom: 10,
                          }}
                        >
                          {OLLAMA_PRESETS.map((p) => {
                            const active = settings.aiModel === p.id
                            return (
                              <button
                                key={p.id}
                                type="button"
                                title={p.note}
                                onClick={() => {
                                  setSetting('aiModel', p.id)
                                  triggerCheck(settings.aiBaseUrl, p.id)
                                }}
                                style={{
                                  appearance: 'none',
                                  border: `0.5px solid ${active ? 'var(--ink-2)' : 'var(--line)'}`,
                                  background: active ? 'var(--paper-deep)' : 'transparent',
                                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                                  font: "500 11px 'JetBrains Mono', ui-monospace",
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  cursor: 'default',
                                }}
                              >
                                {p.id}
                              </button>
                            )
                          })}
                        </div>
                        <input
                          type="text"
                          value={settings.aiModel}
                          placeholder="e.g. gemma3:4b"
                          onChange={(e) => {
                            setSetting('aiModel', e.target.value)
                            setModelStatus('idle')
                          }}
                          onBlur={(e) => triggerCheck(settings.aiBaseUrl, e.target.value)}
                          style={inputStyle}
                        />
                        <ModelStatusBadge
                          status={modelStatus}
                          model={settings.aiModel}
                          baseUrl={settings.aiBaseUrl}
                          pullProgress={pullProgress}
                          onPull={() => void handlePull()}
                        />
                      </div>

                      <label style={{ display: 'block' }}>
                        <span
                          style={{
                            font: "400 13px 'Inter', system-ui",
                            color: 'var(--ink-2)',
                            display: 'block',
                          }}
                        >
                          {t.settings.ai.apiKey}
                        </span>
                        <small
                          style={{
                            display: 'block',
                            font: "400 11px/1.4 'Inter', system-ui",
                            color: 'var(--ink-4)',
                            marginTop: 3,
                            marginBottom: 8,
                          }}
                        >
                          {t.settings.ai.apiKeyDesc}{' '}
                          <code
                            style={{
                              fontFamily: "'JetBrains Mono', ui-monospace",
                              fontSize: '10.5px',
                            }}
                          >
                            Authorization: Bearer
                          </code>
                          .
                        </small>
                        <input
                          type="password"
                          autoComplete="off"
                          value={settings.aiApiKey}
                          placeholder="••••••••"
                          onChange={(e) => setSetting('aiApiKey', e.target.value)}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  ) : (
                    <LocalModelPanel
                      status={llm.status}
                      progress={llm.progress}
                      progressText={llm.progressText}
                      error={llm.error}
                    />
                  )}
                </div>
              </div>
            )}

            {tab === 'review' && (
              <>
                <SettingsFormRow
                  label={t.settings.review.retention}
                  description={t.settings.review.retentionDesc}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                        font: "500 12px 'JetBrains Mono', ui-monospace",
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
                  label={t.settings.review.maxInterval}
                  description={t.settings.review.maxIntervalDesc}
                  last
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
        </div>
      </div>
    </ModalOverlay>
  )
}
