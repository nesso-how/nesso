// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback } from 'react'
import { useGraphStore } from '@/store'
import { useWebLLM } from '@/llm/webllm'
import { CloseButton } from '@/components/ui/CloseButton'
import { LocalModelPanel } from '@/components/mentor/LocalModelPanel'
import { ModelStatusBadge } from '@/components/mentor/ModelStatusBadge'
import { SettingsFormRow } from '@/components/ui/SettingsFormRow'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { PillToggle } from '@/components/ui/PillToggle'
import { Stepper } from '@/components/ui/Stepper'
import { useT } from '@/i18n'
import type { Language } from '@/types/graph'
import { isDesktop } from '@/lib/isDesktop'
import { getDefaultWorkspacePath, pickWorkspaceFolder, resolveWorkspacePath } from '@/lib/workspace'
import { checkOllamaModel, streamOllamaModelPull, type OllamaModelStatus } from '@/lib/ollama'

const OLLAMA_PRESETS = [
  { id: 'gemma3:4b', note: 'balanced · recommended' },
  { id: 'llama3.2:3b', note: 'lightweight · fast' },
  { id: 'qwen2.5:7b', note: 'precise · best reasoning' },
] as const

type Tab = 'appearance' | 'ai' | 'review' | 'data'
const ALL_TABS = ['appearance', 'ai', 'review', 'data'] as const

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
  const switchGraphWorkspace = useGraphStore((s) => s.switchGraphWorkspace)
  const [workspaceLabel, setWorkspaceLabel] = useState('')
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

  useEffect(() => {
    if (!open || !isDesktop()) return
    void (async () => {
      const path = await resolveWorkspacePath(settings)
      setWorkspaceLabel(path)
    })()
  }, [open, settings.graphWorkspacePath])

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

  const subtleLinkStyle: React.CSSProperties = {
    appearance: 'none',
    background: 'none',
    border: 'none',
    color: 'var(--ink-4)',
    font: "400 11px 'Inter', system-ui",
    cursor: 'default',
    padding: 0,
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
            borderRadius: 18,
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
              background: 'var(--paper-deep)',
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
            {ALL_TABS.filter((id) => id !== 'data' || isDesktop()).map((tabId) => (
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
          <div
            className="nesso-scrollbar"
            style={{ flex: 1, padding: '24px 28px 24px', overflowY: 'auto', minWidth: 0 }}
          >
            <div style={{ marginBottom: 22 }}>
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
                  <PillToggle
                    options={[
                      { id: 'light', label: t.settings.appearance.light },
                      { id: 'dark', label: t.settings.appearance.dark },
                    ]}
                    value={settings.dark ? 'dark' : 'light'}
                    onChange={(id) => setSetting('dark', id === 'dark')}
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
                  <PillToggle
                    options={LANGUAGES.map((lang) => ({ id: lang.id, label: lang.label }))}
                    value={settings.language}
                    onChange={(id) => setSetting('language', id)}
                  />
                </div>
              </div>
            )}

            {tab === 'data' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {isDesktop() && (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-2)' }}>
                        {t.settings.data.graphFolder}
                      </span>
                      <small
                        style={{
                          display: 'block',
                          font: "400 11px/1.4 'Inter', system-ui",
                          color: 'var(--ink-4)',
                          marginTop: 3,
                        }}
                      >
                        {t.settings.data.graphFolderDesc}
                      </small>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: '0.5px solid var(--line)',
                        borderRadius: 10,
                        background: 'var(--paper-deep)',
                        padding: '6px 6px 6px 12px',
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: 'var(--ink-4)', flexShrink: 0 }}
                      >
                        <path d="M2 5.5a1 1 0 0 1 1-1h3.5l1.5 1.5h5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5z" />
                      </svg>
                      <span
                        title={workspaceLabel}
                        dir={settings.graphWorkspacePath ? 'rtl' : 'ltr'}
                        style={{
                          font: "400 12px 'JetBrains Mono', ui-monospace",
                          color: settings.graphWorkspacePath ? 'var(--ink-3)' : 'var(--ink-4)',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                        }}
                      >
                        {settings.graphWorkspacePath ?? t.settings.data.graphFolderDefault}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            const picked = await pickWorkspaceFolder()
                            if (!picked) return
                            await switchGraphWorkspace(picked)
                          })()
                        }}
                        style={{
                          appearance: 'none',
                          border: '0.5px solid var(--line)',
                          background: 'var(--bg-card)',
                          color: 'var(--ink-2)',
                          font: "500 11px 'JetBrains Mono', ui-monospace",
                          letterSpacing: '0.04em',
                          padding: '5px 12px',
                          borderRadius: 999,
                          cursor: 'default',
                          flexShrink: 0,
                        }}
                      >
                        {t.settings.data.chooseFolder}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!workspaceLabel) return
                          void (async () => {
                            const { openPath } = await import('@tauri-apps/plugin-opener')
                            await openPath(workspaceLabel).catch(() => {})
                          })()
                        }}
                        style={subtleLinkStyle}
                      >
                        {t.settings.data.openFolder}
                      </button>
                      {settings.graphWorkspacePath && (
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              await switchGraphWorkspace(null)
                              const path = await getDefaultWorkspacePath()
                              setWorkspaceLabel(path)
                            })()
                          }}
                          style={subtleLinkStyle}
                        >
                          {t.settings.data.resetFolder}
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                  <PillToggle
                    options={[
                      { id: 'local', label: t.settings.ai.local },
                      { id: 'remote', label: t.settings.ai.remote },
                    ]}
                    value={settings.aiMode}
                    onChange={(mode) => setSetting('aiMode', mode)}
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
                        <PillToggle
                          tone="soft"
                          style={{ marginBottom: 10 }}
                          options={OLLAMA_PRESETS.map((p) => ({
                            id: p.id,
                            label: p.id,
                            title: p.note,
                          }))}
                          value={settings.aiModel}
                          onChange={(id) => {
                            setSetting('aiModel', id)
                            triggerCheck(settings.aiBaseUrl, id)
                          }}
                        />
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
