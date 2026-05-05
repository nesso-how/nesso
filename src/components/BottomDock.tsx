interface Props {
  legendOpen: boolean
  onToggleLegend: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  zoom: number
  onAddConcept: () => void
}

export function BottomDock({ legendOpen, onToggleLegend, onZoomIn, onZoomOut, onFit, zoom, onAddConcept }: Props) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: 18,
      transform: 'translateX(-50%)',
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 999,
      padding: 5,
      boxShadow: 'var(--shadow-md)',
    }}>
      <DockBtn active={legendOpen} onClick={onToggleLegend}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 4h10M2 7h10M2 10h6" />
        </svg>
        <span style={{ marginLeft: 6, font: "500 11px 'JetBrains Mono', ui-monospace" }}>relations</span>
      </DockBtn>

      <Sep />

      <DockBtn mono onClick={onZoomOut}>−</DockBtn>

      <span
        style={{
          font: "500 11px 'JetBrains Mono', ui-monospace",
          color: 'var(--ink-3)',
          padding: '0 6px',
          minWidth: 38,
          textAlign: 'center',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>

      <DockBtn mono onClick={onZoomIn}>+</DockBtn>

      <DockBtn onClick={onFit} title="Center map">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="7" cy="7" r="2" />
          <path d="M7 1v2M7 11v2M1 7h2M11 7h2" />
        </svg>
      </DockBtn>

      <Sep />

      <DockBtn
        onClick={onAddConcept}
        style={{
          background: 'var(--ink)',
          color: 'var(--paper)',
          paddingLeft: 12,
          paddingRight: 14,
        }}
      >
        <span style={{ font: "500 11px 'JetBrains Mono', ui-monospace" }}>+ concept</span>
      </DockBtn>
    </div>
  )
}

function Sep() {
  return <span style={{ width: 1, height: 18, background: 'var(--line)', display: 'inline-block' }} />
}

function DockBtn({
  children, active, mono, onClick, style, title,
}: {
  children: React.ReactNode
  active?: boolean
  mono?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 0,
        background: active ? 'var(--paper-deep)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        height: 28,
        minWidth: 28,
        padding: mono ? 0 : '0 10px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        font: mono ? "500 14px 'Fraunces', serif" : 'inherit',
        ...style,
      }}
      onMouseEnter={e => { if (!style?.background) e.currentTarget.style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { if (!style?.background) e.currentTarget.style.background = active ? 'var(--paper-deep)' : 'transparent' }}
    >
      {children}
    </button>
  )
}
