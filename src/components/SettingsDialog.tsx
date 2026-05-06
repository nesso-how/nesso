// SPDX-License-Identifier: AGPL-3.0
import { useGraphStore } from '@/store/graph'
import { useWebLLM, initWebLLM, LOCAL_MODEL_LABEL, LOCAL_MODEL_SIZE } from '@/llm/webllm'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const settings = useGraphStore(s => s.settings)
  const setSetting = useGraphStore(s => s.setSetting)
  const llm = useWebLLM()

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
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '92vw',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 18,
          padding: '28px 32px 24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 20 }}>
          Settings
        </div>

        <div style={{ font: "500 10px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 12, borderBottom: '0.5px solid var(--line)', paddingBottom: 6 }}>
          AI
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
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
              {mode === 'remote' ? 'Remote API' : 'Local model'}
            </button>
          ))}
        </div>

        {settings.aiMode === 'remote' ? (
          <>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>API base URL</span>
              <input
                type="text"
                value={settings.aiBaseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={e => setSetting('aiBaseUrl', e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Model</span>
              <input
                type="text"
                value={settings.aiModel}
                placeholder="gemma2:2b"
                onChange={e => setSetting('aiModel', e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>API key</span>
              <input
                type="password"
                autoComplete="off"
                value={settings.aiApiKey}
                placeholder="••••••••"
                onChange={e => setSetting('aiApiKey', e.target.value)}
                style={inputStyle}
              />
              <small style={{ font: "400 11px/1.4 'Inter', system-ui", color: 'var(--ink-4)', display: 'block', marginTop: 8 }}>
                Usually empty for local Ollama. For hosted APIs, set whatever secret your endpoint expects as <code style={{ fontFamily: "'JetBrains Mono', ui-monospace", fontSize: '10.5px' }}>Authorization: Bearer</code>.
              </small>
            </label>
          </>
        ) : (
          <LocalModelPanel status={llm.status} progress={llm.progress} progressText={llm.progressText} error={llm.error} />
        )}

        <div style={{ marginTop: 20, borderTop: '0.5px solid var(--line)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              appearance: 'none',
              border: '0.5px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
              font: "500 12px 'JetBrains Mono', ui-monospace",
              padding: '8px 16px',
              borderRadius: 999,
              cursor: 'default',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

interface LocalModelPanelProps {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  progressText: string
  error: string | null
}

function LocalModelPanel({ status, progress, progressText, error }: LocalModelPanelProps) {
  return (
    <div style={{
      border: '0.5px solid var(--line)',
      borderRadius: 12,
      padding: '16px',
      background: 'var(--paper-deep)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ font: "500 13px 'Fraunces', serif", color: 'var(--ink)' }}>{LOCAL_MODEL_LABEL}</span>
        <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>{LOCAL_MODEL_SIZE}</span>
        {status === 'ready' && (
          <span style={{
            marginLeft: 'auto',
            font: "500 10px 'JetBrains Mono', ui-monospace",
            color: 'var(--conf-5)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Ready</span>
        )}
      </div>

      {status === 'idle' && (
        <>
          <p style={{ font: "400 12px/1.5 'Inter', system-ui", color: 'var(--ink-3)', margin: '0 0 12px' }}>
            Runs entirely in-browser via WebGPU. The model is cached after the first download.
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
            Download &amp; use
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
          Model loaded in-browser. Socrates will use it instead of the remote API.
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
            Retry
          </button>
        </>
      )}
    </div>
  )
}
