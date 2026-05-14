// SPDX-License-Identifier: MIT
import { useState, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import type { Node } from '@xyflow/react'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import { TOPBAR_HEIGHT_PX } from './TopBar'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import type { ConceptElaboration, EdgeTypeName, ConceptNodeData } from '@/types/graph'
import { useT } from '@/i18n'

/** Added to inspector width when computing canvas left inset (matches 296px panel → 326px inset). */
export const INSPECTOR_CANVAS_LEFT_GUTTER = 30

export const INSPECTOR_PANEL_MIN_WIDTH = 220
export const INSPECTOR_PANEL_MAX_WIDTH = 520
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 296

const INSPECTOR_WIDTH_STORAGE_KEY = 'nesso-inspector-width'

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

/** Matches `marginTop` on the actions footer. */
const INSPECTOR_FOOTER_MARGIN_TOP = 14
/** Matches App `bottomInset`; keeps inspector clear of BottomDock canvas padding. */
const INSPECTOR_VIEWPORT_BOTTOM_RESERVE = 80

function formatConceptDue(dueMs: number, dueNow: string): string {
  if (dueMs <= 0 || dueMs <= Date.now()) return dueNow
  const days = Math.ceil((dueMs - Date.now()) / 86_400_000)
  if (days <= 1) return '< 1d'
  return `${days}d`
}

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

function InspectorPanel({
  leftOffset,
  panelWidth,
  onPanelWidthChange,
  children,
}: {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
  children: ReactNode
}) {
  function startResize(mouseDownClientX: number) {
    const startX = mouseDownClientX
    const startW = panelWidth

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      onPanelWidthChange(clampInspectorPanelWidth(startW + dx))
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
      left: leftOffset + 18,
      top: TOPBAR_HEIGHT_PX,
      width: panelWidth,
      zIndex: 25,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 14,
      padding: '16px 16px 10px',
      paddingRight: 20,
      boxShadow: 'var(--shadow-md)',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: `calc(100vh - ${TOPBAR_HEIGHT_PX}px - ${INSPECTOR_VIEWPORT_BOTTOM_RESERVE}px)`,
    }}>
      {children}

      <button
        type="button"
        aria-valuenow={Math.round(panelWidth)}
        aria-valuemin={INSPECTOR_PANEL_MIN_WIDTH}
        aria-valuemax={INSPECTOR_PANEL_MAX_WIDTH}
        aria-label={`Resize inspector width (${panelWidth}px). Arrow keys adjust width.`}
        title="Drag to resize inspector"
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
          top: 10,
          bottom: 10,
          right: 4,
          width: 10,
          borderRadius: 5,
          cursor: 'col-resize',
          touchAction: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--line) 55%, transparent)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      />
    </div>
  )
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
  const { edges, nodes, deleteNode, setSelected } = useGraphStore()
  const [tab, setTab] = useState<'overview' | 'notes'>('overview')

  const outgoing = edges.filter(e => e.source === node.id)
  const incoming = edges.filter(e => e.target === node.id)

  const focusNode = (id: string) => setSelected({ kind: 'node', id })

  const elab = node.data.elaboration
  const overviewImageUrl = elab?.imageUrl?.trim()
  const overviewDefinition = elab?.definition?.trim() ?? ''


  return (
    <InspectorPanel
      leftOffset={leftOffset}
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0,
      }}>
        <div style={{ flexShrink: 0 }}>
          {/* Crumb */}
          <div style={{
            font: "500 10.5px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}>
            <span>{t.inspector.concept}</span>
          </div>

          {tab === 'overview' && overviewImageUrl ? (
            <div style={{
              margin: '6px 0 0',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <div style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: 10,
                overflow: 'hidden',
                border: '0.5px solid var(--line)',
                background: 'var(--paper-deep)',
              }}>
                <img
                  src={overviewImageUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <h3 style={{
                margin: 0,
                flex: 1,
                minWidth: 0,
                font: "500 22px/1.2 'Fraunces', ui-serif, Georgia, serif",
                letterSpacing: '-0.012em',
              }}>
                {node.data.text}
              </h3>
            </div>
          ) : (
            <h3 style={{
              margin: '6px 0 0',
              font: "500 22px/1.2 'Fraunces', ui-serif, Georgia, serif",
              letterSpacing: '-0.012em',
            }}>
              {node.data.text}
            </h3>
          )}

          {tab === 'overview' && overviewDefinition.length > 0 && (
            <div style={{
              marginTop: 10,
              font: "14px/1.55 'Inter', system-ui",
              color: 'var(--ink-2)',
              whiteSpace: 'pre-wrap',
            }}>
              {elab?.definition}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, margin: '12px 0 4px' }}>
            {(['overview', 'notes'] as const).map(tabKey => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setTab(tabKey)}
                style={{
                  flex: 1,
                  font: "500 11px 'JetBrains Mono', ui-monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '5px 0',
                  borderRadius: 7,
                  border: '0.5px solid var(--line)',
                  background: tab === tabKey ? 'var(--bg-card)' : 'transparent',
                  color: tab === tabKey ? 'var(--ink)' : 'var(--ink-3)',
                  cursor: 'default',
                  transition: 'all 0.1s',
                }}
              >
                {t.inspector.tabs[tabKey]}
              </button>
            ))}
          </div>
        </div>

        <div
          className="nesso-scrollbar"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            marginRight: -2,
            paddingRight: 2,
          }}
        >
          {tab === 'overview' && (
            <>
              <InspectorRow label={t.inspector.rows.due}>
                <span style={{
                  font: "500 12px 'JetBrains Mono', ui-monospace",
                  color: node.data.due <= Date.now() ? 'var(--cat-causal)' : 'var(--ink-2)',
                }}>
                  {formatConceptDue(node.data.due, t.inspector.dueNow)}
                </span>
              </InspectorRow>

              <InspectorRow label={t.inspector.rows.stability}>
                <span style={{ font: "500 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)' }}>
                  {node.data.stability.toFixed(1)}d
                </span>
              </InspectorRow>

              <InspectorRow label={t.inspector.rows.lastRating}>
                <span style={{ font: "500 12px 'JetBrains Mono', ui-monospace", color: 'var(--ink-2)' }}>
                  {t.inspector.ratingNames[Math.min(4, Math.max(0, node.data.lastRating ?? 0))]}
                </span>
              </InspectorRow>

              <div style={{ marginTop: 12 }}>
                {outgoing.length > 0 && <EdgeGroupHeader label={t.inspector.outgoing} count={outgoing.length} />}
                {outgoing.map(e => {
                  const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                  const C = EDGE_CATEGORIES[T.cat]
                  const target = nodes.find(n => n.id === e.target)
                  return (
                    <EdgeRow key={e.id} label={t.edgeTypes.types[e.data?.type as EdgeTypeName]} text={target?.data.text ?? ''} color={C.color} glyph={T.glyph} onClick={() => focusNode(e.target)} />
                  )
                })}

                {incoming.length > 0 && <EdgeGroupHeader label={t.inspector.incoming} count={incoming.length} />}
                {incoming.map(e => {
                  const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
                  const C = EDGE_CATEGORIES[T.cat]
                  const source = nodes.find(n => n.id === e.source)
                  return (
                    <EdgeRow key={e.id} label={`← ${t.edgeTypes.types[e.data?.type as EdgeTypeName]}`} text={source?.data.text ?? ''} color={C.color} glyph={T.glyph} onClick={() => focusNode(e.source)} />
                  )
                })}
              </div>
            </>
          )}
          {tab === 'notes' && <NotesTab node={node} />}
        </div>

        {/* Actions */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 6,
            marginTop: INSPECTOR_FOOTER_MARGIN_TOP,
            paddingTop: 12,
          }}
        >
          <ActionBtn danger onClick={() => deleteNode(node.id)}>{t.inspector.delete}</ActionBtn>
        </div>
      </div>
    </InspectorPanel>
  )
}

function NotesTab({ node }: { node: Node<ConceptNodeData> }) {
  const t = useT()
  const updateNodeData = useGraphStore(s => s.updateNodeData)
  const elab = node.data.elaboration

  const update = (patch: Partial<ConceptElaboration>) =>
    updateNodeData(node.id, {
      elaboration: { definition: '', examples: '', notes: '', ...elab, ...patch },
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
      <ImagePicker conceptLabel={node.data.text} elab={elab} onUpdate={update} />
      <ElabField label={t.inspector.notes.definition} placeholder={t.inspector.notes.definitionPlaceholder} value={elab?.definition ?? ''} onChange={v => update({ definition: v })} />
      <ElabField label={t.inspector.notes.examples} placeholder={t.inspector.notes.examplesPlaceholder} value={elab?.examples ?? ''} onChange={v => update({ examples: v })} rows={4} />
      <ElabField label={t.inspector.notes.notes} placeholder={t.inspector.notes.notesPlaceholder} value={elab?.notes ?? ''} onChange={v => update({ notes: v })} rows={3} />
    </div>
  )
}

function ElabField({ label, placeholder, value, onChange, rows = 3 }: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div>
      <div style={{
        font: "600 10px 'JetBrains Mono', ui-monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
        marginBottom: 5,
      }}>
        {label}
      </div>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          resize: 'vertical',
          font: "14px/1.5 'Inter', system-ui",
          color: 'var(--ink)',
          background: 'var(--paper-deep)',
          border: '0.5px solid var(--line)',
          borderRadius: 7,
          padding: '7px 9px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--line)' }}
      />
    </div>
  )
}

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
      return {
        title: p.title,
        thumbUrl: info.thumburl!,
        descriptionUrl,
      }
    })
}

function commonsFilePageUrl(title: string): string {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

function ImagePicker({
  conceptLabel,
  elab,
  onUpdate,
}: {
  conceptLabel: string
  elab: ConceptElaboration | undefined
  onUpdate: (patch: Partial<ConceptElaboration>) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WikiImage[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const imageUrl = elab?.imageUrl
  const hasImage = Boolean(imageUrl?.trim())

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    try {
      setResults(await searchCommonsImages(q))
    }
    finally {
      setLoading(false)
    }
  }

  if (hasImage && imageUrl) {
    const attrHref = elab?.imageDescriptionUrl?.trim() || (elab?.imageTitle ? commonsFilePageUrl(elab.imageTitle) : undefined)
    const attrLabel = elab?.imageTitle?.replace(/^File:/, '') ?? 'Image'
    return (
      <div style={{ position: 'relative' }}>
        <div style={{
          width: '100%',
          borderRadius: 7,
          overflow: 'hidden',
          border: '0.5px solid var(--line)',
          background: 'var(--paper-deep)',
          maxHeight: 160,
        }}>
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
          />
        </div>
        <button
          type="button"
          aria-label="Remove image"
          onClick={() =>
            onUpdate({
              imageUrl: undefined,
              imageTitle: undefined,
              imageDescriptionUrl: undefined,
            })}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '0.5px solid var(--line)',
            background: 'var(--bg-elev)',
            color: 'var(--ink)',
            font: "600 14px ui-sans-serif",
            lineHeight: 1,
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
        {attrHref && (
          <a
            href={attrHref}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              display: 'block',
              marginTop: 6,
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {attrLabel}
          </a>
        )}
      </div>
    )
  }

  if (open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <form onSubmit={runSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.inspector.image.searchPlaceholder}
            style={{
              flex: 1,
              minWidth: 0,
              font: "12px 'Inter', system-ui",
              color: 'var(--ink)',
              background: 'var(--paper-deep)',
              border: '0.5px solid var(--line)',
              borderRadius: 7,
              padding: '6px 9px',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              flexShrink: 0,
              appearance: 'none',
              border: '0.5px solid var(--line)',
              background: 'var(--paper-deep)',
              color: 'var(--ink-2)',
              font: "500 11px 'JetBrains Mono', ui-monospace",
              padding: '7px 10px',
              borderRadius: 7,
              cursor: loading ? 'wait' : 'default',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {t.inspector.image.search}
          </button>
        </form>
        {results.length > 0 && (
          <div style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 6,
            scrollbarWidth: 'thin',
          }}>
            {results.map(img => (
              <button
                key={img.title}
                type="button"
                onClick={() => {
                  onUpdate({
                    imageUrl: img.thumbUrl,
                    imageTitle: img.title,
                    imageDescriptionUrl: img.descriptionUrl,
                  })
                  setOpen(false)
                  setResults([])
                  setQuery('')
                }}
                style={{
                  flex: '0 0 auto',
                  width: 80,
                  padding: 0,
                  border: '0.5px solid var(--line)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'default',
                  background: 'var(--paper-deep)',
                  height: 80,
                  boxSizing: 'border-box',
                }}
              >
                <img src={img.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setOpen(false); setResults([]) }}
          style={{
            alignSelf: 'flex-start',
            appearance: 'none',
            border: 'none',
            background: 'none',
            color: 'var(--ink-3)',
            font: "500 10px 'JetBrains Mono', ui-monospace",
            cursor: 'default',
            padding: 0,
          }}
        >
          {t.inspector.image.cancel}
        </button>
      </div>
    )
  }

  return (
    <ActionBtn
      onClick={() => {
        setQuery(conceptLabel.trim())
        setOpen(true)
      }}
    >
      {t.inspector.image.addImage}
    </ActionBtn>
  )
}

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

      {/* From → glyph → To */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 18px' }}>
        <span style={{ font: "500 14px 'Fraunces', serif" }}>{from?.data.text}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
          <GlyphSVG kind={T.glyph} color={C.color} size={14} />
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
        </div>
        <span style={{ font: "500 14px 'Fraunces', serif" }}>{to?.data.text}</span>
      </div>

      <div style={{ font: "500 18px 'JetBrains Mono', ui-monospace", color: C.color, marginBottom: 12 }}>
        {t.edgeTypes.types[edgeType]}
      </div>

      {/* Sharpen */}
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

      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 14,
        paddingTop: 12,
      }}>
        <ActionBtn danger onClick={() => deleteEdge(edge.id)}>{t.inspector.deleteRelation}</ActionBtn>
      </div>
    </InspectorPanel>
  )
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderTop: '0.5px dashed var(--line)',
    }}>
      <span style={{
        font: "500 11px 'JetBrains Mono', ui-monospace",
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function EdgeGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <h5 style={{
      margin: '14px 0 6px',
      font: "600 10px 'JetBrains Mono', ui-monospace",
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--ink-4)',
    }}>
      {label} · {count}
    </h5>
  )
}

function EdgeRow({ label, text, color, glyph, onClick }: {
  label: string; text: string; color: string; glyph: string; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: 8,
        alignItems: 'center',
        padding: '5px 6px',
        borderRadius: 5,
        cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <GlyphSVG kind={glyph as any} color={color} size={14} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ font: "500 10.5px 'JetBrains Mono', ui-monospace", color }}>{label}</span>
        <span style={{
          font: "500 13px 'Fraunces', serif",
          color: 'var(--ink)',
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

function ActionBtn({ children, danger, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) {
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
