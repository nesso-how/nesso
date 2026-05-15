// SPDX-License-Identifier: MIT
import { useState, useEffect, useLayoutEffect, useRef, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import { CloseButton } from './CloseButton'
import { TOPBAR_HEIGHT_PX } from './TopBar'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import type { ConceptElaboration, EdgeTypeName } from '@/types/graph'
import { useT } from '@/i18n'
import { INSPECTOR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'

/** Inset of the inspector panel from TopBar (below) and sidebar (right); canvas uses 2× this (panel + gap to graph). */
const INSPECTOR_PANEL_EDGE_INSET = 12

export const INSPECTOR_CANVAS_LEFT_GUTTER = INSPECTOR_PANEL_EDGE_INSET * 2

export const INSPECTOR_PANEL_MIN_WIDTH = 220
export const INSPECTOR_PANEL_MAX_WIDTH = 520
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 296

export function clampInspectorPanelWidth(w: number): number {
  return Math.min(
    INSPECTOR_PANEL_MAX_WIDTH,
    Math.max(INSPECTOR_PANEL_MIN_WIDTH, Math.round(w)),
  )
}

export function readInspectorPanelWidth(): number {
  try {
    const raw = localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY)
    if (raw == null) return INSPECTOR_PANEL_DEFAULT_WIDTH
    return clampInspectorPanelWidth(Number(raw))
  }
  catch {
    return INSPECTOR_PANEL_DEFAULT_WIDTH
  }
}

export function writeInspectorPanelWidth(w: number): void {
  try {
    localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(clampInspectorPanelWidth(w)))
  }
  catch { /* ignore quota / privacy mode */ }
}

/** Matches App `bottomInset`; keeps inspector clear of BottomDock canvas padding. */
const INSPECTOR_VIEWPORT_BOTTOM_RESERVE = 80

function formatConceptDue(dueMs: number, dueNow: string): string {
  if (dueMs <= 0 || dueMs <= Date.now()) return dueNow
  const days = Math.ceil((dueMs - Date.now()) / 86_400_000)
  if (days <= 1) return '< 1d'
  return `${days}d`
}

// ─── shared sub-components ───────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" style={{
      opacity: 0.55,
      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
      transition: 'transform 140ms',
      flexShrink: 0,
    }}>
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InlineEdit({
  value,
  placeholder,
  onSave,
  textStyle,
  multiline = false,
  maxLength,
  initialEditing = false,
  noEditBorder = false,
  borderedPlaceholder = false,
  onShiftEnter,
}: {
  value: string
  placeholder: string
  onSave: (v: string) => void
  textStyle?: React.CSSProperties
  multiline?: boolean
  maxLength?: number
  initialEditing?: boolean
  noEditBorder?: boolean
  borderedPlaceholder?: boolean
  onShiftEnter?: () => void
}) {
  const [editing, setEditing] = useState(initialEditing)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      try { el.setSelectionRange(el.value.length, el.value.length) } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [editing])

  useLayoutEffect(() => {
    if (!editing || !multiline) return
    const el = ref.current as HTMLTextAreaElement | null
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, draft, multiline])

  const commit = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  const baseStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    appearance: 'none',
    resize: 'none',
    background: 'transparent',
    border: 0,
    outline: 'none',
    padding: 0,
    margin: 0,
    fontFamily: 'inherit',
    ...textStyle,
  }

  const editWrapper: React.CSSProperties = noEditBorder ? {} : {
    margin: '-4px -6px',
    padding: '4px 6px',
    boxShadow: '0 0 0 1px var(--line)',
    borderRadius: 6,
    background: 'var(--bg-card)',
  }

  if (editing) {
    const editEl = multiline ? (
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        maxLength={maxLength}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
          if (e.key === 'Enter' && e.shiftKey && onShiftEnter) { e.preventDefault(); commit(); onShiftEnter() }
          else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
        }}
        style={{ ...baseStyle, overflow: 'hidden', resize: 'none', ...(borderedPlaceholder && { padding: '5px 8px' }) } as React.CSSProperties}
      />
    ) : (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        style={baseStyle}
      />
    )
    if (noEditBorder) return editEl
    return <div style={editWrapper}>{editEl}</div>
  }

  const empty = !value

  if (empty && borderedPlaceholder) {
    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          border: '0.5px dashed var(--line)',
          borderRadius: 7,
          padding: '5px 8px',
          font: "450 12px 'Inter', system-ui",
          color: 'var(--ink-5)',
          cursor: 'default',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        ...textStyle,
        cursor: 'text',
        color: empty ? 'var(--ink-4)' : (textStyle?.color ?? 'var(--ink)'),
        fontStyle: textStyle?.fontStyle ?? 'normal',
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        wordBreak: 'break-word',
        minHeight: '1.4em',
        ...(borderedPlaceholder && { padding: '5px 8px' }),
      }}
    >
      {empty ? placeholder : value}
    </div>
  )
}

// ─── image search (real Wikimedia Commons API) ────────────────────────────────

interface WikiImage {
  title: string
  thumbUrl: string
  descriptionUrl: string
}

async function searchCommonsImages(query: string): Promise<WikiImage[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|thumburl|descriptionurl',
    iiurlwidth: '200',
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
  if (!res.ok) throw new Error('Search failed')
  const data: {
    query?: {
      pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string }> }>
    }
  } = await res.json()
  const pages = data.query?.pages
  if (!pages) return []
  return Object.values(pages)
    .filter(p => p.imageinfo?.[0]?.thumburl)
    .map(p => {
      const info = p.imageinfo![0]
      const descriptionUrl =
        info.descriptionurl
        ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
      return { title: p.title, thumbUrl: info.thumburl!, descriptionUrl }
    })
}

function ImageSearchPanel({
  query,
  setQuery,
  conceptText,
  onPick,
  onClose,
}: {
  query: string
  setQuery: (q: string) => void
  conceptText: string
  onPick: (img: WikiImage) => void
  onClose: () => void
}) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<WikiImage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) setQuery(conceptText || '')
    const timer = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    try { setResults(await searchCommonsImages(q)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--bg-card)',
      borderBottom: '0.5px solid var(--line)',
      padding: '10px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <form
        onSubmit={runSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--paper)',
          border: '0.5px solid var(--line)',
          borderRadius: 7,
          padding: '6px 9px',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--ink-4)" strokeWidth="1.6" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L13 13" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.inspector.image.searchPlaceholder}
          style={{
            flex: 1,
            minWidth: 0,
            appearance: 'none',
            border: 0,
            background: 'transparent',
            outline: 'none',
            padding: 0,
            font: "450 12.5px 'Inter', system-ui",
            color: 'var(--ink)',
          }}
        />
        {results.length > 0 && (
          <span style={{
            font: "500 9px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink-5)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            {results.length} hits
          </span>
        )}
        {loading && (
          <span style={{ font: "500 9px 'JetBrains Mono'", color: 'var(--ink-5)', flexShrink: 0 }}>…</span>
        )}
        <CloseButton onClick={onClose} />
      </form>

      {results.length > 0 && (
        <div className="nesso-scrollbar" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {results.map(img => (
              <button
                key={img.title}
                type="button"
                onClick={() => onPick(img)}
                style={{
                  appearance: 'none', border: 0, padding: 0, cursor: 'default',
                  height: 70, borderRadius: 7, overflow: 'hidden',
                  boxShadow: 'inset 0 0 0 0.5px var(--line)',
                }}
              >
                <img src={img.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inspector (router) ───────────────────────────────────────────────────────

export function Inspector({
  leftOffset = 0,
  panelWidth,
  onPanelWidthChange,
}: {
  leftOffset?: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)

  if (selectedNode) {
    return (
      <NodeInspector
        leftOffset={leftOffset}
        panelWidth={panelWidth}
        onPanelWidthChange={onPanelWidthChange}
      />
    )
  }
  if (selectedEdge) {
    return (
      <EdgeInspector
        leftOffset={leftOffset}
        panelWidth={panelWidth}
        onPanelWidthChange={onPanelWidthChange}
      />
    )
  }
  return null
}

// ─── InspectorPanel (shell with resize handle) ───────────────────────────────

function InspectorPanel({
  leftOffset,
  panelWidth,
  onPanelWidthChange,
  children,
  noPadding = false,
}: {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
  children: ReactNode
  noPadding?: boolean
}) {
  const t = useT()

  function startResize(mouseDownClientX: number) {
    const startX = mouseDownClientX
    const startW = panelWidth
    function onMove(ev: MouseEvent) {
      onPanelWidthChange(clampInspectorPanelWidth(startW + ev.clientX - startX))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeEdgeMouseDown(e: ReactMouseEvent) {
    e.preventDefault()
    startResize(e.clientX)
  }

  return (
    <div style={{
      position: 'absolute',
      left: leftOffset + INSPECTOR_PANEL_EDGE_INSET,
      top: TOPBAR_HEIGHT_PX + INSPECTOR_PANEL_EDGE_INSET,
      width: panelWidth,
      zIndex: 25,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 14,
      padding: noPadding ? 0 : '16px 16px 10px',
      paddingRight: noPadding ? 0 : 20,
      boxShadow: 'var(--shadow-md)',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: noPadding ? 'hidden' : 'visible',
      maxHeight: `calc(100vh - ${TOPBAR_HEIGHT_PX + INSPECTOR_PANEL_EDGE_INSET}px - ${INSPECTOR_VIEWPORT_BOTTOM_RESERVE}px)`,
    }}>
      {children}

      <button
        type="button"
        aria-valuenow={Math.round(panelWidth)}
        aria-valuemin={INSPECTOR_PANEL_MIN_WIDTH}
        aria-valuemax={INSPECTOR_PANEL_MAX_WIDTH}
        aria-label={`Resize inspector width (${panelWidth}px). Arrow keys adjust width.`}
        title={t.inspector.resizeHandle}
        onMouseDown={onResizeEdgeMouseDown}
        onKeyDown={(e) => {
          const step = 12
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onPanelWidthChange(clampInspectorPanelWidth(panelWidth - step))
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            onPanelWidthChange(clampInspectorPanelWidth(panelWidth + step))
          }
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
    </div>
  )
}

// ─── NodeInspector ────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  font: "500 10px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

function NodeInspector({
  leftOffset,
  panelWidth,
  onPanelWidthChange,
}: {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const t = useT()
  const node = useGraphStore(selectedNodeSelector)!
  const { edges, nodes, deleteNode, setSelected, updateNodeData, settings, setSetting } = useGraphStore()

  const examplesOpen = settings.inspectorExamplesOpen
  const relationsOpen = settings.inspectorRelationsOpen
  const [imageMode, setImageMode] = useState<'view' | 'search'>('view')
  const [imageQuery, setImageQuery] = useState('')
  const [imageHover, setImageHover] = useState(false)
  const [pendingNewExample, setPendingNewExample] = useState(false)
  const [pendingKey, setPendingKey] = useState(0)

  useEffect(() => {
    setImageMode('view')
    setImageQuery('')
    setPendingNewExample(false)
  }, [node.id])

  const elab = node.data.elaboration
  const imageUrl = elab?.imageUrl?.trim()
  const hasImage = Boolean(imageUrl)

  const patch = (p: Partial<ConceptElaboration>) =>
    updateNodeData(node.id, {
      elaboration: { definition: '', examples: '', notes: '', ...elab, ...p },
    })

  const outgoing = edges.filter(e => e.source === node.id)
  const incoming = edges.filter(e => e.target === node.id)
  const focusNode = (id: string) => setSelected({ kind: 'node', id })

  const isDue = node.data.due <= 0 || node.data.due <= Date.now()

  // Examples as a clean array — empty strings are excluded from storage
  const examplesArr = (elab?.examples ?? '').split('\n').filter(s => s.length > 0)

  const saveExamples = (arr: string[]) => patch({ examples: arr.join('\n') })
  const updateExample = (idx: number, value: string) => {
    const next = [...examplesArr]
    next[idx] = value
    saveExamples(next.filter(s => s.length > 0))
  }
  const addExample = () => { setPendingNewExample(true); setPendingKey(k => k + 1) }
  const savePendingExample = (v: string) => {
    if (v.trim()) saveExamples([...examplesArr, v.trim()])
    setPendingNewExample(false)
  }
  const removeExample = (idx: number) => saveExamples(examplesArr.filter((_, i) => i !== idx))

  return (
    <InspectorPanel
      leftOffset={leftOffset}
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
      noPadding
    >
      {/* Image search panel (replaces header when active) */}
      {imageMode === 'search' && (
        <ImageSearchPanel
          query={imageQuery}
          setQuery={setImageQuery}
          conceptText={node.data.text}
          onPick={(img) => {
            patch({ imageUrl: img.thumbUrl, imageTitle: img.title, imageDescriptionUrl: img.descriptionUrl })
            setImageMode('view')
            setImageQuery('')
            setImageHover(false)
          }}
          onClose={() => { setImageMode('view'); setImageQuery(''); setImageHover(false) }}
        />
      )}

      {/* Header */}
      {imageMode === 'view' && (
        <div style={{
          position: 'relative',
          flexShrink: 0,
          padding: '14px 14px 12px 14px',
          borderBottom: '0.5px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Image icon button */}
          <button
            type="button"
            onMouseEnter={() => setImageHover(true)}
            onMouseLeave={() => setImageHover(false)}
            onClick={() => { setImageQuery(node.data.text); setImageMode('search') }}
            title={hasImage ? t.inspector.image.search : t.inspector.image.addImage}
            style={{
              appearance: 'none',
              border: 0,
              padding: 0,
              cursor: 'default',
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 10,
              background: hasImage
                ? 'var(--paper-deep)'
                : `repeating-linear-gradient(45deg, var(--paper-deep) 0 6px, var(--bg-card) 6px 12px)`,
              boxShadow: 'inset 0 0 0 0.5px var(--line)',
              position: 'relative',
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hasImage ? (
              <img src={imageUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink-4)" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L13 13" strokeLinecap="round" />
              </svg>
            )}
            {hasImage && imageHover && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(26,24,20,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(244,242,234,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 2.5l2 2-8 8-2.5.5.5-2.5 8-8z" /><path d="M10 4l2 2" />
                </svg>
              </div>
            )}
          </button>

          {/* Inline-editable title */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
            <InlineEdit
              value={node.data.text}
              placeholder="Untitled"
              multiline
              noEditBorder
              maxLength={120}
              onSave={v => { if (v.trim()) updateNodeData(node.id, { text: v.trim().replace(/\n+/g, ' ') }) }}
              textStyle={{
                font: "500 22px/1.15 'Fraunces', ui-serif, Georgia, serif",
                letterSpacing: '-0.012em',
                color: 'var(--ink)',
              }}
            />
          </div>

          {/* Close button */}
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <CloseButton onClick={() => setSelected(null)} />
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div
        className="nesso-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* FSRS meta strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderTop: '0.5px dashed var(--line)',
          borderBottom: '0.5px dashed var(--line)',
          padding: '8px 0',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={LABEL_STYLE}>{t.inspector.rows.due}</span>
            <span style={{
              font: "500 12px 'JetBrains Mono', ui-monospace",
              color: isDue ? 'var(--cat-causal)' : 'var(--ink-2)',
            }}>
              {formatConceptDue(node.data.due, t.inspector.dueNow)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderLeft: '0.5px dashed var(--line)', paddingLeft: 12 }}>
            <span style={LABEL_STYLE}>{t.inspector.rows.stability}</span>
            <span style={{ font: "500 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)' }}>
              {node.data.stability.toFixed(1)}d
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderLeft: '0.5px dashed var(--line)', paddingLeft: 12 }}>
            <span style={LABEL_STYLE}>{t.inspector.rows.lastRating}</span>
            <span style={{ font: "500 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)' }}>
              {t.inspector.ratingNames[Math.min(4, Math.max(0, node.data.lastRating ?? 0))]}
            </span>
          </div>
        </div>

        {/* Definition */}
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>
            {t.inspector.notes.definition}
          </div>
          <InlineEdit
            value={elab?.definition ?? ''}
            placeholder={t.inspector.notes.definitionPlaceholder}
            onSave={v => patch({ definition: v })}
            multiline
            noEditBorder
            borderedPlaceholder
            maxLength={2000}
            textStyle={{
              font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif",
              color: 'var(--ink-2)',
            }}
          />
        </div>

        {/* Examples — collapsible */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setSetting('inspectorExamplesOpen', !examplesOpen)}
              style={{
                appearance: 'none', border: 0, background: 'transparent', cursor: 'default',
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
                ...LABEL_STYLE,
              }}
            >
              <Chevron open={examplesOpen} />
              <span>{t.inspector.notes.examples}</span>
              {examplesArr.length > 0 && (
                <span style={{ font: "450 10px 'JetBrains Mono', ui-monospace", color: 'var(--ink-5)', textTransform: 'none', letterSpacing: 0 }}>
                  {examplesArr.length}
                </span>
              )}
            </button>
            {examplesOpen && (
              <button
                type="button"
                onClick={addExample}
                style={{
                  appearance: 'none', border: 0, background: 'transparent',
                  font: "450 11px 'Inter', system-ui", color: 'var(--ink-4)', cursor: 'default',
                  textTransform: 'none', letterSpacing: 0, padding: 0,
                }}
              >
                ＋ Add
              </button>
            )}
          </div>

          {examplesOpen && (
            examplesArr.length === 0 && !pendingNewExample ? (
              <button
                type="button"
                onClick={addExample}
                style={{
                  appearance: 'none', border: '0.5px dashed var(--line)',
                  background: 'transparent', width: '100%',
                  padding: '8px 10px', borderRadius: 7, cursor: 'default',
                  font: "450 12px 'Inter', system-ui", color: 'var(--ink-5)', textAlign: 'left',
                }}
              >
                {t.inspector.notes.examplesPlaceholder}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {examplesArr.map((ex, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 1fr 18px',
                    gap: 6,
                    alignItems: 'flex-start',
                    padding: '3px 0',
                  }}>
                    <span style={{ color: 'var(--cat-causal)', font: "500 13px 'JetBrains Mono', ui-monospace", lineHeight: 1.55 }}>·</span>
                    <InlineEdit
                      value={ex}
                      placeholder="example…"
                      multiline
                      noEditBorder
                      maxLength={500}
                      onSave={v => updateExample(i, v)}
                      onShiftEnter={addExample}
                      textStyle={{ font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif", color: 'var(--ink-2)' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExample(i)}
                      title="Remove"
                      style={{
                        appearance: 'none', border: 0, background: 'transparent',
                        color: 'var(--ink-5)', cursor: 'default',
                        font: "500 10px 'Inter', system-ui", padding: 0, lineHeight: 1.55,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {pendingNewExample && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 1fr 18px',
                    gap: 6,
                    alignItems: 'flex-start',
                    padding: '3px 0',
                  }}>
                    <span style={{ color: 'var(--cat-causal)', font: "500 13px 'JetBrains Mono', ui-monospace", lineHeight: 1.55 }}>·</span>
                    <InlineEdit
                      key={pendingKey}
                      value=""
                      placeholder="example…"
                      multiline
                      noEditBorder
                      maxLength={500}
                      onSave={savePendingExample}
                      onShiftEnter={addExample}
                      initialEditing
                      textStyle={{ font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif", color: 'var(--ink-2)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setPendingNewExample(false)}
                      title="Remove"
                      style={{
                        appearance: 'none', border: 0, background: 'transparent',
                        color: 'var(--ink-5)', cursor: 'default',
                        font: "500 10px 'Inter', system-ui", padding: 0, lineHeight: 1.55,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Relations — collapsible */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => setSetting('inspectorRelationsOpen', !relationsOpen)}
              style={{
                appearance: 'none', border: 0, background: 'transparent', cursor: 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...LABEL_STYLE }}>
                <Chevron open={relationsOpen} />
                <span>{t.inspector.relations}</span>
              </span>
              <span style={{ font: "450 11px 'Inter', system-ui", color: 'var(--ink-5)', textTransform: 'none', letterSpacing: 0 }}>
                {outgoing.length + incoming.length}
              </span>
            </button>

            {relationsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {outgoing.map(e => {
                  const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                  const C = EDGE_CATEGORIES[T.cat]
                  const target = nodes.find(n => n.id === e.target)
                  return (
                    <EdgeRow
                      key={e.id}
                      label={t.edgeTypes.types[e.data?.type as EdgeTypeName]}
                      text={target?.data.text ?? ''}
                      color={C.color}
                      glyph={T.glyph}
                      onClick={() => focusNode(e.target)}
                    />
                  )
                })}
                {incoming.map(e => {
                  const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                  const C = EDGE_CATEGORIES[T.cat]
                  const source = nodes.find(n => n.id === e.source)
                  return (
                    <EdgeRow
                      key={e.id}
                      label={`← ${t.edgeTypes.types[e.data?.type as EdgeTypeName]}`}
                      text={source?.data.text ?? ''}
                      color={C.color}
                      glyph={T.glyph}
                      onClick={() => focusNode(e.source)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>
            {t.inspector.notes.notes}
          </div>
          <InlineEdit
            value={elab?.notes ?? ''}
            placeholder={t.inspector.notes.notesPlaceholder}
            onSave={v => patch({ notes: v })}
            multiline
            noEditBorder
            borderedPlaceholder
            maxLength={2000}
            textStyle={{
              font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif",
              color: 'var(--ink-2)',
            }}
          />
        </div>
      </div>
    </InspectorPanel>
  )
}

// ─── EdgeInspector ────────────────────────────────────────────────────────────

function EdgeInspector({
  leftOffset,
  panelWidth,
  onPanelWidthChange,
}: {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const t = useT()
  const edge = useGraphStore(selectedEdgeSelector)!
  const { nodes, updateEdgeType, deleteEdge } = useGraphStore()
  const edgeType = edge.data?.type as EdgeTypeName
  const T = EDGE_TYPES[edgeType]
  const C = EDGE_CATEGORIES[T.cat]
  const from = nodes.find(n => n.id === edge.source)
  const to = nodes.find(n => n.id === edge.target)
  const siblings = Object.entries(EDGE_TYPES).filter(([, edgeDef]) => edgeDef.cat === T.cat) as [EdgeTypeName, typeof T][]

  return (
    <InspectorPanel
      leftOffset={leftOffset}
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <div style={{
        font: "500 10.5px 'JetBrains Mono', ui-monospace",
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{t.inspector.relation}</span>
        <span style={{ color: C.color }}>{t.edgeTypes.categories[T.cat].label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 18px' }}>
        <span style={{ font: "500 13.5px 'Fraunces', serif" }}>{from?.data.text}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
          <GlyphSVG kind={T.glyph} color={C.color} size={14} />
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
        </div>
        <span style={{ font: "500 13.5px 'Fraunces', serif" }}>{to?.data.text}</span>
      </div>

      <div style={{ font: "500 18px 'JetBrains Mono', ui-monospace", color: C.color, marginBottom: 12 }}>
        {t.edgeTypes.types[edgeType]}
      </div>

      <h5 style={{
        margin: '14px 0 6px',
        font: "600 10px 'JetBrains Mono', ui-monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
      }}>
        {t.inspector.sharpen}
      </h5>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {siblings.map(([k]) => (
          <button
            key={k}
            onClick={() => updateEdgeType(edge.id, k)}
            style={{
              font: "500 11px 'JetBrains Mono', ui-monospace",
              padding: '4px 9px',
              borderRadius: 999,
              border: `0.5px solid ${k === edgeType ? C.color : 'var(--line)'}`,
              background: k === edgeType ? C.color : 'transparent',
              color: k === edgeType ? 'var(--paper)' : 'var(--ink-2)',
              cursor: 'default',
            }}
          >
            {t.edgeTypes.types[k]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12 }}>
        <ActionBtn danger onClick={() => deleteEdge(edge.id)}>{t.inspector.deleteRelation}</ActionBtn>
      </div>
    </InspectorPanel>
  )
}

// ─── helper components ────────────────────────────────────────────────────────

function EdgeRow({ label, text, color, glyph, onClick }: {
  label: string; text: string; color: string; glyph: string; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr',
        gap: 8,
        alignItems: 'center',
        padding: '5px 4px',
        borderRadius: 5,
        cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <GlyphSVG kind={glyph as Parameters<typeof GlyphSVG>[0]['kind']} color={color} size={14} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{
          font: "500 10px 'JetBrains Mono', ui-monospace",
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {label}
        </span>
        <span style={{
          font: "500 13.5px 'Fraunces', serif",
          color: 'var(--ink)',
          letterSpacing: '-0.005em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {text}
        </span>
      </div>
    </div>
  )
}

function ActionBtn({ children, danger, onClick }: { children: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        appearance: 'none',
        border: '0.5px solid var(--line)',
        background: 'var(--paper-deep)',
        color: danger ? 'var(--cat-opposition)' : 'var(--ink-2)',
        font: "500 11px 'JetBrains Mono', ui-monospace",
        padding: '7px 8px',
        borderRadius: 7,
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(138,46,74,0.06)' : 'var(--bg-card)'
        e.currentTarget.style.color = danger ? 'var(--cat-opposition)' : 'var(--ink)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--paper-deep)'
        e.currentTarget.style.color = danger ? 'var(--cat-opposition)' : 'var(--ink-2)'
      }}
    >
      {children}
    </button>
  )
}
