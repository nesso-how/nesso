// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback } from 'react'
import { useGraphStore } from '@/store/graph'
import { useWebLLM, initWebLLM, LOCAL_MODEL_LABEL, LOCAL_MODEL_SIZE } from '@/llm/webllm'
import { CloseButton } from './CloseButton'
import { useT } from '@/i18n'
import type { Language } from '@/types/graph'

const OLLAMA_PRESETS = [
  { id: 'gemma3:4b', note: 'balanced · recommended' },
  { id: 'llama3.2:3b', note: 'lightweight · fast' },
  { id: 'qwen2.5:7b', note: 'precise · best reasoning' },
] as const

type ModelStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'pulling' | 'error'

function ollamaNativeBase(aiBaseUrl: string): string {
  return aiBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
}

async function checkOllamaModel(baseUrl: string, model: string): Promise<'available' | 'unavailable' | 'error'> {
  try {
    const url = baseUrl.replace(/\/+$/, '')
    const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return 'error'
    const data = await res.json() as { data?: { id: string }[] }
    const ids = (data.data ?? []).map(m => m.id)
    return ids.includes(model) ? 'available' : 'unavailable'
  } catch {
    return 'error'
  }
}

async function* streamOllamaModelPull(baseUrl: string, model: string): AsyncGenerator<number> {
  const res = await fetch(`${ollamaNativeBase(baseUrl)}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const obj = JSON.parse(line) as { status: string; total?: number; completed?: number }
      if (obj.total && obj.completed != null) yield obj.completed / obj.total
    }
  }
}

type Tab = 'appearance' | 'ai' | 'review'
const TABS = ['appearance', 'ai', 'review'] as const

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
  const settings = useGraphStore(s => s.settings)
  const setSetting = useGraphStore(s => s.setSetting)
  const llm = useWebLLM()
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [pullProgress, setPullProgress] = useState(0)

  const triggerCheck = useCallback((baseUrl: string, model: string) => {
    if (!model) { setModelStatus('idle'); return }
    setModelStatus('checking')
    checkOllamaModel(baseUrl, model)
      .then(s => setModelStatus(s))
      .catch(() => setModelStatus('error'))
  }, [])

  const handlePull = useCallback(async () => {
    setModelStatus('pulling')
    setPullProgress(0)
    try {
      for await (const p of streamOllamaModelPull(settings.aiBaseUrl, settings.aiModel)) {
        setPullProgress(p)
      }
      setModelStatus('available')
    } catch {
      setModelStatus('error')
    }
  }, [settings.aiBaseUrl, settings.aiModel])

  useEffect(() => {
    if (!open || settings.aiMode !== 'remote') { setModelStatus('idle'); return }
    let cancelled = false
    setModelStatus('checking')
    checkOllamaModel(settings.aiBaseUrl, settings.aiModel)
      .then(s => { if (!cancelled) setModelStatus(s) })
      .catch(() => { if (!cancelled) setModelStatus('error') })
    return () => { cancelled = true }
  }, [open, settings.aiMode, settings.aiBaseUrl])

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'none',
    border: '0.5px solid var(--line)',
    borderRadius: 10,
    padding: '10px 12px',
    background: 'var(--paper-deep)',
    color: 'var(--ink)',
    font: "400 13px 'JetBrains Mono', ui-monospace",
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 75,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          <CloseButton large onClick={onClose} />
        </div>
        <div style={{
          width: 660, maxWidth: '94vw',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          overflow: 'hidden',
          minHeight: 340,
        }}
      >
        {/* Sidebar */}
        <div style={{
          width: 156,
          flexShrink: 0,
          borderRight: '0.5px solid var(--line)',
          background: 'var(--paper-deep)',
          padding: '20px 12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{ font: "500 10px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-4)', padding: '0 8px', marginBottom: 10 }}>
            {t.settings.title}
          </div>
          {TABS.map(tabId => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              style={{
                appearance: 'none',
                border: 'none',
                background: tab === tabId ? 'var(--bg-card)' : 'transparent',
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
        <div className="nesso-scrollbar" style={{ flex: 1, padding: '24px 28px 24px', overflowY: 'auto', minWidth: 0 }}>
          <div style={{ marginBottom: 22 }}>
            <span style={{ font: "500 14px 'Inter', system-ui", color: 'var(--ink)' }}>
              {t.settings.tabs[tab]}
            </span>
          </div>

          {tab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>{t.settings.appearance.theme}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[{ label: t.settings.appearance.light, dark: false }, { label: t.settings.appearance.dark, dark: true }].map(opt => {
                    const active = settings.dark === opt.dark
                    return (
                      <button
                        key={String(opt.dark)}
                        onClick={() => setSetting('dark', opt.dark)}
                        style={{
                          appearance: 'none',
                          border: `0.5px solid ${active ? 'var(--ink-2)' : 'var(--line)'}`,
                          background: active ? 'var(--ink-2)' : 'transparent',
                          color: active ? 'var(--paper)' : 'var(--ink-3)',
                          font: "500 11px 'JetBrains Mono', ui-monospace",
                          letterSpacing: '0.04em',
                          padding: '5px 12px',
                          borderRadius: 999,
                          cursor: 'default',
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ borderTop: '0.5px solid var(--line)', paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)' }}>{t.settings.appearance.language}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {LANGUAGES.map(lang => {
                    const active = settings.language === lang.id
                    return (
                      <button
                        key={lang.id}
                        onClick={() => setSetting('language', lang.id)}
                        style={{
                          appearance: 'none',
                          border: `0.5px solid ${active ? 'var(--ink-2)' : 'var(--line)'}`,
                          background: active ? 'var(--ink-2)' : 'transparent',
                          color: active ? 'var(--paper)' : 'var(--ink-3)',
                          font: "500 11px 'JetBrains Mono', ui-monospace",
                          letterSpacing: '0.04em',
                          padding: '5px 12px',
                          borderRadius: 999,
                          cursor: 'default',
                          transition: 'all 0.15s',
                        }}
                      >
                        {lang.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {(['remote', 'local'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSetting('aiMode', mode)}
                    style={{
                      appearance: 'none',
                      border: `0.5px solid ${settings.aiMode === mode ? 'var(--cat-causal)' : 'var(--line)'}`,
                      background: settings.aiMode === mode ? 'var(--cat-causal)' : 'transparent',
                      color: settings.aiMode === mode ? 'var(--paper)' : 'var(--ink-3)',
                      font: "500 11px 'JetBrains Mono', ui-monospace",
                      letterSpacing: '0.04em',
                      padding: '6px 14px',
                      borderRadius: 999,
                      cursor: 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    {mode === 'remote' ? t.settings.ai.remote : t.settings.ai.local}
                  </button>
                ))}
              </div>

              {settings.aiMode === 'remote' ? (
                <>
                  <label style={{ display: 'block', marginBottom: 14 }}>
                    <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>{t.settings.ai.apiBaseUrl}</span>
                    <input
                      type="text"
                      value={settings.aiBaseUrl}
                      placeholder="http://localhost:11434/v1"
                      onChange={e => setSetting('aiBaseUrl', e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <div style={{ marginBottom: 14 }}>
                    <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 8 }}>{t.settings.ai.model}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {OLLAMA_PRESETS.map(p => {
                        const active = settings.aiModel === p.id
                        return (
                          <button
                            key={p.id}
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
                              borderRadius: 999,
                              cursor: 'default',
                              transition: 'all 0.12s',
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
                      onChange={e => { setSetting('aiModel', e.target.value); setModelStatus('idle') }}
                      onBlur={e => triggerCheck(settings.aiBaseUrl, e.target.value)}
                      style={inputStyle}
                    />
                    <ModelStatusBadge status={modelStatus} model={settings.aiModel} baseUrl={settings.aiBaseUrl} pullProgress={pullProgress} onPull={() => void handlePull()} />
                  </div>

                  <label style={{ display: 'block' }}>
                    <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>{t.settings.ai.apiKey}</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={settings.aiApiKey}
                      placeholder="••••••••"
                      onChange={e => setSetting('aiApiKey', e.target.value)}
                      style={inputStyle}
                    />
                    <small style={{ font: "400 11px/1.4 'Inter', system-ui", color: 'var(--ink-4)', display: 'block', marginTop: 8 }}>
                      {t.settings.ai.apiKeyHint} <code style={{ fontFamily: "'JetBrains Mono', ui-monospace", fontSize: '10.5px' }}>Authorization: Bearer</code>.
                    </small>
                  </label>
                </>
              ) : (
                <LocalModelPanel status={llm.status} progress={llm.progress} progressText={llm.progressText} error={llm.error} />
              )}
            </>
          )}

          {tab === 'review' && (
            <>
              <SettingRow label={t.settings.review.retention} description={t.settings.review.retentionDesc}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range"
                    className="settings-slider"
                    min={70}
                    max={97}
                    step={1}
                    value={Math.round(settings.fsrsRetention * 100)}
                    onChange={e => setSetting('fsrsRetention', Number(e.target.value) / 100)}
                    style={{
                      width: 110,
                      background: (() => {
                        const pct = ((Math.round(settings.fsrsRetention * 100) - 70) / 27) * 100
                        return `linear-gradient(to right, var(--ink-2) ${pct}%, var(--line-strong) ${pct}%)`
                      })(),
                    }}
                  />
                  <span style={{ font: "500 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)', minWidth: 32, textAlign: 'right' }}>
                    {Math.round(settings.fsrsRetention * 100)}%
                  </span>
                </div>
              </SettingRow>

              <SettingRow label={t.settings.review.maxInterval} description={t.settings.review.maxIntervalDesc} last>
                <Stepper
                  value={settings.maximumInterval}
                  min={1}
                  max={36500}
                  onChange={v => setSetting('maximumInterval', v)}
                />
              </SettingRow>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, description, last, children }: {
  label: string
  description: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      paddingBottom: last ? 0 : 18,
      marginBottom: last ? 0 : 18,
      borderBottom: last ? 'none' : '0.5px solid var(--line)',
    }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-2)' }}>{label}</span>
        <small style={{ display: 'block', font: "400 11px/1.4 'Inter', system-ui", color: 'var(--ink-4)', marginTop: 3 }}>
          {description}
        </small>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Stepper({ value, min, max, onChange }: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const btnStyle: React.CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-3)',
    font: "400 14px 'Inter', system-ui",
    width: 24,
    height: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'default',
    flexShrink: 0,
    lineHeight: 1,
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      border: '0.5px solid var(--line)',
      borderRadius: 6,
      background: 'var(--paper-deep)',
      overflow: 'hidden',
    }}>
      <button style={btnStyle} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input
        type="number"
        className="settings-stepper"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.min(max, Math.max(min, Math.floor(Number(e.target.value)) || 0)))}
        style={{
          width: 44,
          border: 'none',
          borderLeft: '0.5px solid var(--line)',
          borderRight: '0.5px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
          font: "500 12px 'JetBrains Mono', ui-monospace",
          textAlign: 'center',
          padding: '3px 0',
          outline: 'none',
        }}
      />
      <button style={btnStyle} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

interface LocalModelPanelProps {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  progressText: string
  error: string | null
}

function ModelStatusBadge({ status, model, baseUrl, pullProgress, onPull }: {
  status: ModelStatus
  model: string
  baseUrl: string
  pullProgress: number
  onPull: () => void
}) {
  const t = useT()
  if (status === 'idle' || !model) return null
  const dot = (color: string) => (
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
  )

  if (status === 'pulling') {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 3, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', borderRadius: 999, background: 'var(--cat-causal)',
            width: `${Math.round(pullProgress * 100)}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>
          {t.settings.ai.pulling(model, Math.round(pullProgress * 100))}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, font: "400 11px 'JetBrains Mono', ui-monospace" }}>
      {status === 'checking' && (
        <>
          <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--ink-4)', flexShrink: 0, animation: 'nx-spin 1s linear infinite', display: 'inline-block' }} />
          <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.checking}</span>
        </>
      )}
      {status === 'available' && (
        <>
          {dot('var(--conf-5)')}
          <span style={{ color: 'var(--conf-5)' }}>{t.settings.ai.status.available}</span>
        </>
      )}
      {status === 'unavailable' && (
        <>
          {dot('var(--conf-2)')}
          <span style={{ color: 'var(--ink-3)' }}>{t.settings.ai.status.notFound}</span>
          <button
            onClick={onPull}
            style={{
              appearance: 'none', border: '0.5px solid var(--cat-causal)', background: 'transparent',
              color: 'var(--cat-causal)', font: "500 11px 'JetBrains Mono', ui-monospace",
              padding: '2px 8px', borderRadius: 6, cursor: 'default',
            }}
          >
            {t.settings.ai.status.pull}
          </button>
        </>
      )}
      {status === 'error' && (/localhost|127\.0\.0\.1/.test(baseUrl) ? (
        /localhost|127\.0\.0\.1/.test(window.location.hostname) ? (
          <>
            {dot('var(--ink-4)')}
            <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.ollamaNotRunning}</span>
            <code style={{ color: 'var(--ink-2)', fontSize: 10.5 }}>ollama serve</code>
          </>
        ) : (
          <>
            {dot('var(--conf-2)')}
            <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.corsBlocked}</span>
            <code style={{ color: 'var(--ink-2)', fontSize: 10.5 }}>OLLAMA_ORIGINS={window.location.origin}</code>
          </>
        )
      ) : (
        <>
          {dot('var(--ink-4)')}
          <span style={{ color: 'var(--ink-4)' }}>{t.settings.ai.status.unreachable}</span>
        </>
      ))}
    </div>
  )
}

function LocalModelPanel({ status, progress, progressText, error }: LocalModelPanelProps) {
  const t = useT()
  return (
    <div style={{
      border: '0.5px solid var(--line)',
      borderRadius: 12,
      padding: '16px',
      background: 'var(--paper-deep)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ font: "500 13px 'Inter', system-ui", color: 'var(--ink)' }}>{LOCAL_MODEL_LABEL}</span>
        <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>{LOCAL_MODEL_SIZE}</span>
        {status === 'ready' && (
          <span style={{
            marginLeft: 'auto',
            font: "500 10px 'JetBrains Mono', ui-monospace",
            color: 'var(--conf-5)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>{t.settings.ai.localModel.ready}</span>
        )}
      </div>

      {status === 'idle' && (
        <>
          <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--ink-3)', margin: '0 0 12px' }}>
            {t.settings.ai.localModel.description}
          </p>
          <button
            onClick={() => void initWebLLM()}
            style={{
              appearance: 'none',
              border: '0.5px solid var(--cat-causal)',
              background: 'transparent',
              color: 'var(--cat-causal)',
              font: "500 12px 'JetBrains Mono', ui-monospace",
              padding: '8px 14px',
              borderRadius: 8,
              cursor: 'default',
            }}
          >
            {t.settings.ai.localModel.download}
          </button>
        </>
      )}

      {status === 'loading' && (
        <>
          <div style={{
            height: 4, borderRadius: 999,
            background: 'var(--line)',
            marginBottom: 8, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: 'var(--cat-causal)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>
            {progressText || 'Loading…'}
          </span>
        </>
      )}

      {status === 'ready' && (
        <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--ink-3)', margin: 0 }}>
          {t.settings.ai.localModel.loaded}
        </p>
      )}

      {status === 'error' && (
        <>
          <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--conf-1)', margin: '0 0 10px' }}>
            {error ?? 'Load failed.'}
          </p>
          <button
            onClick={() => void initWebLLM()}
            style={{
              appearance: 'none',
              border: '0.5px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-3)',
              font: "500 12px 'JetBrains Mono', ui-monospace",
              padding: '7px 12px',
              borderRadius: 8,
              cursor: 'default',
            }}
          >
            {t.settings.ai.localModel.retry}
          </button>
        </>
      )}
    </div>
  )
}
