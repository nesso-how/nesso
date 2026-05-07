// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'

export const SIDEBAR_WIDTH = 248

interface Props {
  collapsed: boolean
  onCollapse: () => void
  onSearch: () => void
  onSettings: () => void
  onShortcuts: () => void
  onSelectConcept: (node: { id: string; position: { x: number; y: number } }) => void
}

export function Sidebar({ collapsed, onCollapse, onSearch, onSettings, onShortcuts, onSelectConcept }: Props) {
  const {
    graphList, currentGraphId, loadGraph, createGraph, renameGraph, deleteGraph,
    nodes, settings, setSetting,
    sidebarDisplayOpen, setSidebarDisplayOpen,
  } = useGraphStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [recentOpen, setRecentOpen] = useState(true)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startRename = (id: string, name: string) => {
    setDraft(name)
    setEditingId(id)
  }

  const commitRename = () => {
    if (editingId && draft.trim()) {
      const g = graphList.find(x => x.id === editingId)
      if (g && draft.trim() !== g.name) renameGraph(editingId, draft.trim())
    }
    setEditingId(null)
    setDraft('')
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraft('')
  }

  const handleNew = async () => {
    const id = await createGraph('Untitled')
    setTimeout(() => {
      const g = useGraphStore.getState().graphList.find(x => x.id === id)
      if (g) startRename(id, g.name)
    }, 50)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (graphList.length <= 1) return
    deleteGraph(id)
  }

  const recentNodes = [...nodes]
    .sort((a, b) => b.data.reviewedAt - a.data.reviewedAt)
    .slice(0, 5)

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, bottom: 0,
      width: collapsed ? 0 : SIDEBAR_WIDTH,
      zIndex: 30,
      overflow: 'hidden',
      transition: 'width 180ms ease',
      background: 'var(--bg-elev)',
      borderRight: '0.5px solid var(--line)',
    }}>
      <div style={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '0.5px solid var(--line)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--accent)', color: 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: "600 13px 'Fraunces', ui-serif, Georgia, serif",
            flexShrink: 0,
          }}>N</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "500 13px 'Inter', ui-sans-serif", color: 'var(--ink)' }}>Nesso</div>
          </div>
          <button onClick={onCollapse} title="Collapse sidebar" style={sidebarHeaderBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M10 4l-4 4 4 4" />
            </svg>
            <span style={{ font: "500 12px 'Inter', ui-sans-serif" }}>Hide</span>
          </button>
        </div>

        {/* Search → ⌘K */}
        <div style={{ padding: '10px 12px 8px', flexShrink: 0 }}>
          <button onClick={onSearch} style={{
            display: 'flex', width: '100%', alignItems: 'center', gap: 9,
            appearance: 'none', border: 0,
            background: 'var(--paper-deep)', borderRadius: 7,
            padding: '7px 10px', cursor: 'default',
            font: "12.5px 'Inter', ui-sans-serif", color: 'var(--ink-4)',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L13 13" strokeLinecap="round" />
            </svg>
            Search or jump…
            <span style={{ marginLeft: 'auto', font: "500 10px 'JetBrains Mono', ui-monospace" }}>⌘K</span>
          </button>
        </div>

        {/* Scrollable body — block flow so sections stack naturally without flex pushing */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Graphs */}
          <div style={{ padding: '10px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabel}>Graphs</span>
            <button title="New graph" onClick={handleNew} style={graphsNewBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="11" height="11" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span style={{ font: "500 11.5px 'Inter', ui-sans-serif" }}>New</span>
            </button>
          </div>

          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...graphList]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(g => {
                const active = g.id === currentGraphId
                const hovered = hoveredId === g.id
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      background: active ? 'var(--paper-deep)' : hovered ? 'var(--paper-deep)' : 'transparent',
                      borderRadius: 6, transition: 'background 100ms',
                    }}
                    onMouseEnter={() => setHoveredId(g.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {editingId === g.id ? (
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
                          flex: 1, border: 0, outline: 0,
                          background: 'transparent',
                          font: "500 13px 'Inter', ui-sans-serif",
                          color: 'var(--ink)',
                          padding: '6px 9px',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => loadGraph(g.id)}
                        onDoubleClick={() => startRename(g.id, g.name)}
                        title={`${g.name} — double-click to rename`}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                          appearance: 'none', border: 0, background: 'transparent',
                          borderRadius: 6, padding: '6px 9px', cursor: 'default', minWidth: 0,
                          font: active ? "500 13px 'Inter', ui-sans-serif" : "13px 'Inter', ui-sans-serif",
                          color: active ? 'var(--ink)' : 'var(--ink-2)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: 999, flexShrink: 0,
                          background: active ? 'var(--accent)' : 'var(--ink-5)',
                        }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.name}
                        </span>
                      </button>
                    )}
                    {graphList.length > 1 && hovered && editingId !== g.id && (
                      <button
                        onClick={e => handleDelete(g.id, e)}
                        title="Delete graph"
                        style={{
                          ...iconBtn,
                          marginRight: 4, flexShrink: 0,
                          color: 'var(--ink-4)',
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
          </div>

          {/* Recent concepts */}
          <div style={{ padding: '14px 12px 4px' }}>
            <button
              onClick={() => setRecentOpen(o => !o)}
              style={{
                appearance: 'none', border: 0, background: 'transparent', cursor: 'default',
                display: 'flex', alignItems: 'center', gap: 6, padding: 0,
              }}
            >
              <span style={sectionLabel}>Recent concepts</span>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{
                opacity: 0.5,
                transform: recentOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 150ms',
              }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {recentOpen && (
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recentNodes.length === 0 ? (
                <span style={{ font: "12px 'Inter'", color: 'var(--ink-4)', padding: '4px 9px' }}>No concepts yet</span>
              ) : recentNodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => onSelectConcept(n)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    appearance: 'none', border: 0, background: 'transparent',
                    borderRadius: 6, padding: '5px 9px', cursor: 'default',
                    font: "12.5px 'Inter', ui-sans-serif", color: 'var(--ink-3)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
                >
                  <span style={{ color: 'var(--ink-5)', flexShrink: 0 }}>·</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.data.text}</span>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Display section — fixed above footer, outside scroll */}
        <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--line)' }}>
          <div style={{ padding: '10px 12px 8px' }}>
            <button
              onClick={() => setSidebarDisplayOpen(!sidebarDisplayOpen)}
              style={{
                appearance: 'none', border: 0, background: 'transparent', cursor: 'default',
                display: 'flex', alignItems: 'center', gap: 6, padding: 0, width: '100%',
              }}
            >
              <span style={sectionLabel}>Display</span>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{
                opacity: 0.5,
                transform: sidebarDisplayOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 150ms',
              }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {sidebarDisplayOpen && (
            <div style={{ padding: '0 12px 10px' }}>
              <DisplayRow label="Theme">
                <Seg
                  options={['Light', 'Dark']}
                  value={settings.dark ? 'Dark' : 'Light'}
                  onChange={v => setSetting('dark', v === 'Dark')}
                />
              </DisplayRow>
              <DisplayRow label="Heatmap">
                <Seg
                  options={['Off', 'On']}
                  value={settings.showHeatmap ? 'On' : 'Off'}
                  onChange={v => setSetting('showHeatmap', v === 'On')}
                />
              </DisplayRow>
              <DisplayRow label="Edges">
                <Seg
                  options={['Full', 'Cat.', 'Min.']}
                  value={settings.edgeEncoding === 'full' ? 'Full' : settings.edgeEncoding === 'category' ? 'Cat.' : 'Min.'}
                  onChange={v => setSetting('edgeEncoding', v === 'Full' ? 'full' : v === 'Cat.' ? 'category' : 'minimal')}
                />
              </DisplayRow>
              <DisplayRow label="Curve">
                <Seg
                  options={['Arc', 'Line']}
                  value={settings.curveStyle === 'arc' ? 'Arc' : 'Line'}
                  onChange={v => setSetting('curveStyle', v === 'Arc' ? 'arc' : 'straight')}
                />
              </DisplayRow>
            </div>
          )}
        </div>

        {/* Footer — Settings + shortcuts (?) */}
        <div style={{
          padding: '10px 12px',
          borderTop: '0.5px solid var(--line)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          flexShrink: 0,
        }}>
          <button type="button" onClick={onSettings} title="Settings (⌘,)" style={sidebarFooterBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M1.5 5h11M1.5 11h11" />
              <circle cx="5" cy="5" r="2" />
              <circle cx="9" cy="11" r="2" />
            </svg>
            <span>Settings</span>
          </button>
          <button type="button" onClick={onShortcuts} title="Keyboard shortcuts (?)" style={shortcutsFooterBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <span style={{ font: "600 14px 'Inter', ui-sans-serif", lineHeight: 1 }}>?</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DisplayRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 0', gap: 12,
    }}>
      <span style={{ font: "12px 'Inter', ui-sans-serif", color: 'var(--ink-3)' }}>{label}</span>
      {children}
    </div>
  )
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--paper-deep)', borderRadius: 6, padding: 2 }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            appearance: 'none', border: 0,
            background: o === value ? 'var(--bg-card)' : 'transparent',
            color: o === value ? 'var(--ink)' : 'var(--ink-4)',
            font: o === value ? "500 11px 'Inter', ui-sans-serif" : "11px 'Inter', ui-sans-serif",
            padding: '3px 9px', borderRadius: 4, cursor: 'default',
            boxShadow: o === value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >{o}</button>
      ))}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  width: 26, height: 26, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink-3)', cursor: 'default',
}

const sidebarHeaderBtn: React.CSSProperties = {
  ...iconBtn,
  width: 'auto',
  height: 28,
  padding: '0 8px 0 6px',
  gap: 5,
}

const graphsNewBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  height: 24, borderRadius: 6,
  padding: '0 7px 0 6px',
  display: 'flex', alignItems: 'center', gap: 5,
  color: 'var(--ink-3)', cursor: 'default',
}

const sidebarFooterBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  height: 28, borderRadius: 6,
  padding: '0 9px',
  display: 'flex', alignItems: 'center', gap: 7,
  color: 'var(--ink-3)', cursor: 'default',
  font: "500 12px 'Inter', ui-sans-serif",
}

const shortcutsFooterBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  width: 28, height: 28, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink-3)', cursor: 'default',
}

const sectionLabel: React.CSSProperties = {
  font: "500 10.5px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
