// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { useGraphStore } from '@/store/graph'
import { useT } from '@/i18n'
import { NessoMark } from './NessoMark'
import { SIDEBAR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 380
export const SIDEBAR_DEFAULT_WIDTH = 248

export function clampSidebarWidth(w: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)))
}

export function readSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (raw == null) return SIDEBAR_DEFAULT_WIDTH
    return clampSidebarWidth(Number(raw))
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

export function writeSidebarWidth(w: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(w)))
  } catch { /* ignore */ }
}

interface Props {
  collapsed: boolean
  onCollapse: () => void
  onSearch: () => void
  onSettings: () => void
  onSelectConcept: (node: { id: string; position: { x: number; y: number } }) => void
  zoom: number
  width: number
  onWidthChange: (w: number) => void
}

export function Sidebar({ collapsed, onCollapse, onSearch, onSettings, onSelectConcept, zoom, width, onWidthChange }: Props) {
  const t = useT()
  const {
    graphList, currentGraphId, loadGraph, createGraph, renameGraph, deleteGraph,
    nodes, edges, settings, setSetting,
    sidebarDisplayOpen, setSidebarDisplayOpen,
  } = useGraphStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [recentOpen, setRecentOpen] = useState(true)
  const [mapOpen, setMapOpen] = useState(true)
  const [isResizing, setIsResizing] = useState(false)

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
    const id = await createGraph(t.sidebar.untitled)
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
    .sort((a, b) => b.data.lastReview - a.data.lastReview)
    .slice(0, 5)

  function startResize(mouseDownClientX: number) {
    const startX = mouseDownClientX
    const startW = width
    setIsResizing(true)
    function onMove(ev: MouseEvent) {
      onWidthChange(clampSidebarWidth(startW + ev.clientX - startX))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      setIsResizing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeHandleMouseDown(e: ReactMouseEvent) {
    e.preventDefault()
    startResize(e.clientX)
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, bottom: 0,
      width: collapsed ? 0 : width,
      zIndex: 30,
      transition: isResizing ? 'none' : 'width 180ms ease',
    }}>
      <div style={{
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        background: 'var(--bg-elev)',
        borderRight: '0.5px solid var(--line)',
      }}>
      <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '0.5px solid var(--line)',
          flexShrink: 0,
        }}>
          <div style={{ flexShrink: 0, color: 'var(--ink)', lineHeight: 0 }} aria-hidden>
            <NessoMark size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "500 13px 'Inter', ui-sans-serif", color: 'var(--ink)' }}>Nesso</div>
          </div>
          <button onClick={onCollapse} title={t.sidebar.collapseSidebar} type="button" style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M10 4l-4 4 4 4" />
            </svg>
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
            {t.sidebar.search}
            <span style={{ marginLeft: 'auto', font: "500 10px 'JetBrains Mono', ui-monospace" }}>⌘K</span>
          </button>
        </div>

        {/* Scrollable body — block flow so sections stack naturally without flex pushing */}
        <div className="nesso-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Graphs */}
          <div style={{ padding: '10px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabel}>{t.sidebar.graphs}</span>
            <button title={t.sidebar.newGraphTitle} onClick={handleNew} style={graphsNewBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="11" height="11" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span style={{ font: "500 11.5px 'Inter', ui-sans-serif" }}>{t.sidebar.newGraph}</span>
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
                        title={`${g.name} — ${t.sidebar.renameHint}`}
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
                        title={t.sidebar.deleteGraph}
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
              <span style={sectionLabel}>{t.sidebar.recentConcepts}</span>
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
                <span style={{ font: "12px 'Inter'", color: 'var(--ink-4)', padding: '4px 9px' }}>{t.sidebar.noConcepts}</span>
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

        {/* Map section — fixed, above Display */}
        <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--line)' }}>
          <div style={{ padding: '10px 12px 8px' }}>
            <button
              onClick={() => setMapOpen(o => !o)}
              style={{
                appearance: 'none', border: 0, background: 'transparent', cursor: 'default',
                display: 'flex', alignItems: 'center', gap: 6, padding: 0, width: '100%',
              }}
            >
              <span style={sectionLabel}>{t.sidebar.stats.title}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{
                opacity: 0.5,
                transform: mapOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 150ms',
              }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {mapOpen && (
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <MapRow label={t.sidebar.stats.concepts} value={String(nodes.length)} />
              <MapRow label={t.sidebar.stats.links} value={String(edges.length)} />
              <MapRow label={t.sidebar.stats.zoom} value={`${Math.round(zoom * 100)}%`} />
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
              <span style={sectionLabel}>{t.sidebar.display}</span>
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
              <DisplayRow label={t.sidebar.displayOptions.heatmap}>
                <Seg
                  options={[
                    { id: 'off', label: t.sidebar.displayOptions.off },
                    { id: 'on', label: t.sidebar.displayOptions.on },
                  ]}
                  value={settings.showHeatmap ? 'on' : 'off'}
                  onChange={v => setSetting('showHeatmap', v === 'on')}
                />
              </DisplayRow>
              <DisplayRow label={t.sidebar.displayOptions.edges}>
                <Seg
                  options={[
                    { id: 'full', label: t.sidebar.displayOptions.full },
                    { id: 'category', label: t.sidebar.displayOptions.cat },
                    { id: 'minimal', label: t.sidebar.displayOptions.min },
                  ]}
                  value={settings.edgeEncoding}
                  onChange={v => setSetting('edgeEncoding', v as 'full' | 'category' | 'minimal')}
                />
              </DisplayRow>
              <DisplayRow label={t.sidebar.displayOptions.curve}>
                <Seg
                  options={[
                    { id: 'arc', label: t.sidebar.displayOptions.arc },
                    { id: 'straight', label: t.sidebar.displayOptions.line },
                  ]}
                  value={settings.curveStyle}
                  onChange={v => setSetting('curveStyle', v as 'arc' | 'straight')}
                />
              </DisplayRow>
            </div>
          )}
        </div>

        {/* Footer — Settings */}
        <div style={{
          padding: '8px 8px',
          borderTop: '0.5px solid var(--line)',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onSettings}
            title={t.sidebar.settingsTitle}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%',
              padding: '7px 9px',
              borderRadius: 6,
              cursor: 'default',
              font: "500 13px 'Inter', ui-sans-serif",
              color: 'var(--ink-3)',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {t.sidebar.settings}
            <span style={{ marginLeft: 'auto', font: "500 10px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)' }}>⌘,</span>
          </button>
        </div>
      </div>
      </div>

      {/* Resize handle — outside overflow:hidden wrapper so it can straddle the border */}
      {!collapsed && (
        <button
          type="button"
          aria-label="Resize sidebar"
          onMouseDown={onResizeHandleMouseDown}
          onKeyDown={(e) => {
            const step = 12
            if (e.key === 'ArrowLeft') { e.preventDefault(); onWidthChange(clampSidebarWidth(width - step)) }
            if (e.key === 'ArrowRight') { e.preventDefault(); onWidthChange(clampSidebarWidth(width + step)) }
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -4,
            width: 8,
            cursor: 'col-resize',
            touchAction: 'none',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  )
}

function MapRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ font: "12px 'Inter', ui-sans-serif", color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ font: "500 11.5px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)' }}>{value}</span>
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

function Seg({ options, value, onChange }: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--paper-deep)', borderRadius: 6, padding: 2 }}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            appearance: 'none', border: 0,
            background: o.id === value ? 'var(--bg-card)' : 'transparent',
            color: o.id === value ? 'var(--ink)' : 'var(--ink-4)',
            font: o.id === value ? "500 11px 'Inter', ui-sans-serif" : "11px 'Inter', ui-sans-serif",
            padding: '3px 9px', borderRadius: 4, cursor: 'default',
            boxShadow: o.id === value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >{o.label}</button>
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

const graphsNewBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  height: 24, borderRadius: 6,
  padding: '0 7px 0 6px',
  display: 'flex', alignItems: 'center', gap: 5,
  color: 'var(--ink-3)', cursor: 'default',
}

const sectionLabel: React.CSSProperties = {
  font: "500 10.5px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
