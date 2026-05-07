// SPDX-License-Identifier: MIT
interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  zoom: number
  onAddConcept: () => void
  sidebarWidth?: number
}

export function BottomDock({ onZoomIn, onZoomOut, onFit, zoom, onAddConcept, sidebarWidth = 0 }: Props) {
  return (
    <div style={{
      position: 'absolute',
      left: `calc(50% + ${sidebarWidth / 2}px)`,
      bottom: 18,
      transform: 'translateX(-50%)',
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 999,
      padding: 4,
      boxShadow: 'var(--shadow-md)',
      transition: 'left 180ms ease',
    }}>
      <DockBtn onClick={onFit} title="Center / fit (F)" style={{ width: 'auto', padding: '0 12px', gap: 6, display: 'flex', alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />
        </svg>
        <span style={{ font: "500 11.5px 'JetBrains Mono', ui-monospace" }}>Center</span>
      </DockBtn>

      <Sep />

      <DockBtn mono onClick={onZoomOut} title="Zoom out">−</DockBtn>

      <button
        onClick={onFit}
        title="Reset zoom"
        style={{
          appearance: 'none', border: 0, background: 'transparent',
          height: 28, padding: '0 8px',
          font: "500 11.5px 'JetBrains Mono', ui-monospace",
          color: 'var(--ink-3)',
          cursor: 'default',
          minWidth: 42,
          textAlign: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)' }}
      >
        {Math.round(zoom * 100)}%
      </button>

      <DockBtn mono onClick={onZoomIn} title="Zoom in">+</DockBtn>

      <Sep />

      <DockBtn
        onClick={onAddConcept}
        title="Add concept"
        style={{
          background: 'var(--ink)',
          color: 'var(--paper)',
          paddingLeft: 12,
          paddingRight: 14,
          gap: 6,
        }}
      >
        <span style={{ font: "500 11.5px 'JetBrains Mono', ui-monospace" }}>+ concept</span>
      </DockBtn>
    </div>
  )
}

function Sep() {
  return <span style={{ width: 1, height: 16, background: 'var(--line)', display: 'inline-block', flexShrink: 0 }} />
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
        font: mono ? "500 15px 'Fraunces', serif" : 'inherit',
        ...style,
      }}
      onMouseEnter={e => { if (!style?.background) { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' } }}
      onMouseLeave={e => { if (!style?.background) { e.currentTarget.style.background = active ? 'var(--paper-deep)' : 'transparent'; e.currentTarget.style.color = active ? 'var(--ink)' : 'var(--ink-3)' } }}
    >
      {children}
    </button>
  )
}
