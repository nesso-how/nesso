interface Props {
  open: boolean
  onClose: () => void
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const SECTIONS: { heading: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    heading: 'General',
    rows: [
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close dialog / deselect' },
    ],
  },
  {
    heading: 'Graph',
    rows: [
      { keys: [mod, 'R'], label: 'Start spaced-repetition review' },
      { keys: ['Del'], label: 'Delete selected concept or relation' },
    ],
  },
]

export function ShortcutsDialog({ open, onClose }: Props) {
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
          Keyboard shortcuts
        </div>

        {SECTIONS.map((section, si) => (
          <div key={section.heading} style={{ marginBottom: si < SECTIONS.length - 1 ? 20 : 0 }}>
            <div style={{ font: "500 10px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 10, borderBottom: '0.5px solid var(--line)', paddingBottom: 6 }}>
              {section.heading}
            </div>
            {section.rows.map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ font: "400 14px/1 'Fraunces', serif", color: 'var(--ink-2)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 16 }}>
                  {row.keys.map((k, i) => (
                    <span key={i} style={{ display: 'contents' }}>
                      {i > 0 && (
                        <span style={{ font: "400 11px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>+</span>
                      )}
                      <span
                        style={{
                          font: "600 11px 'JetBrains Mono', ui-monospace",
                          background: 'var(--paper-deep)',
                          border: '0.5px solid var(--line)',
                          borderRadius: 5,
                          padding: '3px 8px',
                          color: 'var(--ink-2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {k}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

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
