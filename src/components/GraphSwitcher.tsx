import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

export function GraphSwitcher() {
  const { graphList, currentGraphId, loadGraph, createGraph, renameGraph, deleteGraph } = useGraphStore()
  const current = graphList.find(g => g.id === currentGraphId)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startRename = () => {
    if (!current) return
    setDraft(current.name)
    setEditing(true)
    setOpen(false)
  }

  const commitRename = () => {
    if (current && draft.trim() && draft.trim() !== current.name) {
      renameGraph(current.id, draft.trim())
    }
    setEditing(false)
  }

  const cancelRename = () => {
    setEditing(false)
    setDraft('')
  }

  const handleSwitch = (id: string) => {
    if (id !== currentGraphId) loadGraph(id)
    setOpen(false)
  }

  const handleNew = async () => {
    await createGraph('Untitled')
    setOpen(false)
    setTimeout(startRename, 50)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (graphList.length <= 1) return
    deleteGraph(id)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', borderLeft: '0.5px solid var(--line)' }}>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') cancelRename()
          }}
          style={{
            border: 0,
            outline: 0,
            background: 'transparent',
            font: "500 12px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink)',
            padding: '0 8px',
            width: Math.max(80, draft.length * 7.5 + 16),
          }}
        />
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          onDoubleClick={startRename}
          title="Switch graph (double-click to rename)"
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            font: "500 12px 'JetBrains Mono', ui-monospace",
            color: open ? 'var(--ink)' : 'var(--ink-3)',
            padding: '0 8px',
            cursor: 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
          }}
          onMouseEnter={e => { if (!open) e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.color = 'var(--ink-3)' }}
        >
          {current?.name ?? '…'}
          <svg width="9" height="9" viewBox="0 0 10 10" style={{ opacity: 0.6 }}>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          minWidth: 240,
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 12,
          padding: 4,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 40,
        }}>
          {[...graphList]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(g => {
              const active = g.id === currentGraphId
              return (
                <div
                  key={g.id}
                  onClick={() => handleSwitch(g.id)}
                  className="nx-graph-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'default',
                    background: active ? 'var(--paper-deep)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--paper-deep)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: active ? 'var(--cat-causal)' : 'transparent',
                    flexShrink: 0,
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{
                      font: "500 13px 'Fraunces', ui-serif, Georgia, serif",
                      color: 'var(--ink)',
                      letterSpacing: '-0.005em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {g.name}
                    </span>
                    <span style={{
                      font: "500 10px 'JetBrains Mono', ui-monospace",
                      color: 'var(--ink-4)',
                      letterSpacing: '0.02em',
                    }}>
                      {timeAgo(g.updatedAt)}
                    </span>
                  </div>
                  {graphList.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(g.id, e)}
                      title="Delete graph"
                      style={{
                        appearance: 'none',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--ink-4)',
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'default',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--bg-elev)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}

          <div style={{ height: 0.5, background: 'var(--line)', margin: '4px 6px' }} />

          <button
            onClick={handleNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              border: 0,
              background: 'transparent',
              borderRadius: 8,
              color: 'var(--ink-3)',
              font: "500 12px 'JetBrains Mono', ui-monospace",
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <svg width="11" height="11" viewBox="0 0 10 10">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            New graph
          </button>
        </div>
      )}
    </div>
  )
}
