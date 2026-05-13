// SPDX-License-Identifier: MIT
interface Props {
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function UndoRedoControls({ onUndo, onRedo, canUndo, canRedo }: Props) {
  return (
    <div style={{
      position: 'absolute',
      top: 64,
      right: 16,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 999,
      padding: 3,
      boxShadow: 'var(--shadow-md)',
    }}>
      <Btn onClick={onUndo} title="Undo (⌘Z)" disabled={!canUndo}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7H11a3 3 0 0 1 0 6H8" /><path d="M6 4L3 7l3 3" />
        </svg>
      </Btn>
      <Btn onClick={onRedo} title="Redo (⌘⇧Z)" disabled={!canRedo}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 7H5a3 3 0 0 0 0 6h3" /><path d="M10 4l3 3-3 3" />
        </svg>
      </Btn>
    </div>
  )
}

function Btn({ children, onClick, title, disabled }: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: 'none',
        border: 0,
        background: 'transparent',
        color: 'var(--ink-3)',
        width: 26,
        height: 26,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'default',
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' } }}
    >
      {children}
    </button>
  )
}
