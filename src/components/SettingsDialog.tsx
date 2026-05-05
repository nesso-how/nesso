// SPDX-License-Identifier: AGPL-3.0
import { useGraphStore } from '@/store/graph'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const settings = useGraphStore(s => s.settings)
  const setSetting = useGraphStore(s => s.setSetting)

  if (!open) return null

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

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>API base URL</span>
          <input
            type="text"
            value={settings.aiBaseUrl}
            placeholder="http://localhost:11434/v1"
            onChange={e => setSetting('aiBaseUrl', e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              appearance: 'none',
              border: '0.5px solid var(--line)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'var(--paper-deep)',
              color: 'var(--ink)',
              font: "400 13px 'JetBrains Mono', ui-monospace",
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Model</span>
          <input
            type="text"
            value={settings.aiModel}
            placeholder="gemma2:2b"
            onChange={e => setSetting('aiModel', e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              appearance: 'none',
              border: '0.5px solid var(--line)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'var(--paper-deep)',
              color: 'var(--ink)',
              font: "400 13px 'JetBrains Mono', ui-monospace",
            }}
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
            style={{
              width: '100%',
              boxSizing: 'border-box',
              appearance: 'none',
              border: '0.5px solid var(--line)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'var(--paper-deep)',
              color: 'var(--ink)',
              font: "400 13px 'JetBrains Mono', ui-monospace",
            }}
          />
          <small style={{ font: "400 11px/1.4 'Inter', system-ui", color: 'var(--ink-4)', display: 'block', marginTop: 8 }}>
            Usually empty for local Ollama. For hosted APIs, set whatever secret your endpoint expects as <code style={{ fontFamily: "'JetBrains Mono', ui-monospace", fontSize: '10.5px' }}>Authorization: Bearer</code>.
          </small>
        </label>

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
