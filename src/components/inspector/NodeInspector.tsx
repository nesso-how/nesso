// SPDX-License-Identifier: MIT
import { useState, useEffect, type CSSProperties } from 'react'
import { RELATION_TYPES, RELATION_CATEGORIES, asEdgeTypeName } from '@/data/relationTypes'
import { useGraphStore, selectedNodeSelector } from '@/store'
import type { ConceptElaboration } from '@/types/graph'
import { useT } from '@/i18n'
import { InlineEdit } from './InlineEdit'
import { ImageSearchPanel } from './ImageSearchPanel'
import { InspectorPanel } from './InspectorPanel'
import { EdgeRow } from './EdgeRow'
import { InspectorActionToolbar, InspectorIconBtn } from './inspectorChrome'

const LABEL_STYLE: CSSProperties = {
  font: "500 11px 'JetBrains Mono', ui-monospace",
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

function formatConceptDue(dueMs: number, dueNow: string): string {
  if (dueMs <= 0 || dueMs <= Date.now()) return dueNow
  const days = Math.ceil((dueMs - Date.now()) / 86_400_000)
  if (days <= 1) return '< 1d'
  return `${days}d`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      style={{
        opacity: 0.5,
        color: 'var(--ink)',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 150ms',
        flexShrink: 0,
      }}
    >
      <path
        d="M2 4l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NodeInspector({
  panelWidth,
  onPanelWidthChange,
}: {
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const t = useT()
  const node = useGraphStore(selectedNodeSelector)!
  const edges = useGraphStore((s) => s.edges)
  const nodes = useGraphStore((s) => s.nodes)
  const setSelected = useGraphStore((s) => s.setSelected)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const settings = useGraphStore((s) => s.settings)
  const setSetting = useGraphStore((s) => s.setSetting)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)

  const memoryOpen = settings.inspectorMemoryOpen
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

  const outgoing = edges.filter((e) => e.source === node.id)
  const incoming = edges.filter((e) => e.target === node.id)
  const focusNode = (id: string) => setSelected({ kind: 'node', id })

  const isDue = node.data.due <= 0 || node.data.due <= Date.now()
  const reps = node.data.reps ?? 0
  const lapses = node.data.lapses ?? 0
  const lastReview = node.data.lastReview ?? 0
  const lastReviewedLabel =
    lastReview <= 0
      ? '—'
      : (() => {
          const d = Math.floor((Date.now() - lastReview) / 86_400_000)
          return d <= 0 ? t.inspector.memory.today : t.inspector.memory.daysAgo(d)
        })()
  const memRows: { label: string; value: string; accent?: boolean; warn?: boolean }[] = [
    {
      label: t.inspector.rows.due,
      value: formatConceptDue(node.data.due, t.inspector.dueNow),
      accent: isDue,
    },
    { label: t.inspector.rows.stability, value: `${node.data.stability.toFixed(1)}d` },
    {
      label: t.inspector.rows.lastRating,
      value: t.inspector.ratingNames[Math.min(4, Math.max(0, node.data.lastRating ?? 0))],
    },
    {
      label: t.inspector.memory.reviews,
      value: lapses > 0 ? `${reps} · ${t.inspector.memory.lapses(lapses)}` : String(reps),
      warn: lapses > 0,
    },
    { label: t.inspector.memory.lastReviewed, value: lastReviewedLabel },
  ]

  // Examples as a clean array — empty strings are excluded from storage
  const examplesArr = (elab?.examples ?? '').split('\n').filter((s) => s.length > 0)

  const saveExamples = (arr: string[]) => patch({ examples: arr.join('\n') })
  const updateExample = (idx: number, value: string) => {
    const next = [...examplesArr]
    next[idx] = value
    saveExamples(next.filter((s) => s.length > 0))
  }
  const addExample = () => {
    setPendingNewExample(true)
    setPendingKey((k) => k + 1)
  }
  const savePendingExample = (v: string) => {
    if (v.trim()) saveExamples([...examplesArr, v.trim()])
    setPendingNewExample(false)
  }
  const removeExample = (idx: number) => saveExamples(examplesArr.filter((_, i) => i !== idx))

  return (
    <InspectorPanel panelWidth={panelWidth} onPanelWidthChange={onPanelWidthChange}>
      {/* Image search panel (replaces header when active) */}
      {imageMode === 'search' && (
        <ImageSearchPanel
          query={imageQuery}
          setQuery={setImageQuery}
          conceptText={node.data.text}
          onPick={(img) => {
            patch({
              imageUrl: img.thumbUrl,
              imageTitle: img.title,
              imageDescriptionUrl: img.descriptionUrl,
            })
            setImageMode('view')
            setImageQuery('')
            setImageHover(false)
          }}
          onClose={() => {
            setImageMode('view')
            setImageQuery('')
            setImageHover(false)
          }}
        />
      )}

      {/* Header */}
      {imageMode === 'view' && (
        <div
          style={{
            flexShrink: 0,
            padding: '12px 14px',
            borderBottom: '0.5px solid var(--line)',
          }}
        >
          {/* Top row — collapse + close */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              marginLeft: -6,
              marginRight: -6,
            }}
          >
            <InspectorIconBtn
              icon="chevron-right"
              title={t.inspector.actions.collapse}
              onClick={() => setInspectorCollapsed(true)}
            />
            <InspectorIconBtn icon="close" title="Esc" onClick={() => setSelected(null)} />
          </div>
          {/* Identity — image + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Image icon button */}
            <button
              type="button"
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
              onClick={() => {
                setImageQuery(node.data.text)
                setImageMode('search')
              }}
              title={hasImage ? t.inspector.image.search : t.inspector.image.addImage}
              style={{
                appearance: 'none',
                border: 0,
                padding: 0,
                cursor: 'default',
                flexShrink: 0,
                width: 48,
                height: 48,
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
                <img
                  src={imageUrl!}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="var(--ink-4)"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L13 13" strokeLinecap="round" />
                </svg>
              )}
              {hasImage && imageHover && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(26,24,20,0.38)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="rgba(244,242,234,0.9)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11.5 2.5l2 2-8 8-2.5.5.5-2.5 8-8z" />
                    <path d="M10 4l2 2" />
                  </svg>
                </div>
              )}
            </button>

            {/* Inline-editable title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <InlineEdit
                value={node.data.text}
                placeholder="Untitled"
                multiline
                noEditBorder
                maxLength={120}
                onSave={(v) => {
                  if (v.trim()) updateNodeData(node.id, { text: v.trim().replace(/\n+/g, ' ') })
                }}
                textStyle={{
                  font: "500 18px/1.2 'Fraunces', ui-serif, Georgia, serif",
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                }}
              />
            </div>
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
        {/* Memory — recall + schedule, collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setSetting('inspectorMemoryOpen', !memoryOpen)}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              marginBottom: memoryOpen ? 11 : 0,
              ...LABEL_STYLE,
            }}
          >
            <span>{t.inspector.memory.title}</span>
            <Chevron open={memoryOpen} />
          </button>
          {memoryOpen && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {memRows.map((r, i) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '7px 0',
                    borderBottom: i === memRows.length - 1 ? 'none' : '0.5px solid var(--line)',
                  }}
                >
                  <span style={{ font: "12px 'Inter', system-ui", color: 'var(--ink-3)' }}>
                    {r.label}
                  </span>
                  <span
                    style={{
                      font: "500 12px 'JetBrains Mono', ui-monospace",
                      color: r.accent
                        ? 'var(--highlight)'
                        : r.warn
                          ? 'var(--cat-opposition)'
                          : 'var(--ink-2)',
                    }}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Definition */}
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>{t.inspector.notes.definition}</div>
          <InlineEdit
            value={elab?.definition ?? ''}
            placeholder={t.inspector.notes.definitionPlaceholder}
            onSave={(v) => patch({ definition: v })}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setSetting('inspectorExamplesOpen', !examplesOpen)}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                cursor: 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                ...LABEL_STYLE,
              }}
            >
              <span>{t.inspector.notes.examples}</span>
              <Chevron open={examplesOpen} />
            </button>
            {examplesOpen && (
              <button
                type="button"
                onClick={addExample}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-3)'
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  cursor: 'default',
                  color: 'var(--ink-3)',
                  font: "500 11.5px 'Inter', ui-sans-serif",
                  padding: '2px 5px',
                  borderRadius: 6,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                  <path
                    d="M5 1v8M1 5h8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                {t.inspector.notes.add}
              </button>
            )}
          </div>

          {examplesOpen &&
            (examplesArr.length === 0 && !pendingNewExample ? (
              <button
                type="button"
                onClick={addExample}
                style={{
                  appearance: 'none',
                  border: '0.5px dashed var(--line)',
                  background: 'transparent',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 7,
                  cursor: 'default',
                  font: "450 12px 'Inter', system-ui",
                  color: 'var(--ink-5)',
                  textAlign: 'left',
                }}
              >
                {t.inspector.notes.examplesPlaceholder}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {examplesArr.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr 18px',
                      gap: 6,
                      alignItems: 'flex-start',
                      padding: '3px 0',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--ink-4)',
                        marginTop: 8,
                      }}
                    />
                    <InlineEdit
                      value={ex}
                      placeholder="example…"
                      multiline
                      noEditBorder
                      maxLength={500}
                      onSave={(v) => updateExample(i, v)}
                      onShiftEnter={addExample}
                      textStyle={{
                        font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif",
                        color: 'var(--ink-2)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExample(i)}
                      title="Remove"
                      style={{
                        appearance: 'none',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--ink-5)',
                        cursor: 'default',
                        font: "500 10px 'Inter', system-ui",
                        padding: 0,
                        lineHeight: 1.55,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {pendingNewExample && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr 18px',
                      gap: 6,
                      alignItems: 'flex-start',
                      padding: '3px 0',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--ink-4)',
                        marginTop: 8,
                      }}
                    />
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
                      textStyle={{
                        font: "400 13.5px/1.55 'Fraunces', ui-serif, Georgia, serif",
                        color: 'var(--ink-2)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPendingNewExample(false)}
                      title="Remove"
                      style={{
                        appearance: 'none',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--ink-5)',
                        cursor: 'default',
                        font: "500 10px 'Inter', system-ui",
                        padding: 0,
                        lineHeight: 1.55,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Notes */}
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>{t.inspector.notes.notes}</div>
          <InlineEdit
            value={elab?.notes ?? ''}
            placeholder={t.inspector.notes.notesPlaceholder}
            onSave={(v) => patch({ notes: v })}
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

        {/* Relations — collapsible */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => setSetting('inspectorRelationsOpen', !relationsOpen)}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                cursor: 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                ...LABEL_STYLE,
              }}
            >
              <span>{t.inspector.relations}</span>
              <Chevron open={relationsOpen} />
            </button>

            {relationsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {outgoing.map((e) => {
                  const relationId = asEdgeTypeName(e.data?.type)
                  const T = RELATION_TYPES[relationId]
                  const C = RELATION_CATEGORIES[T.cat]
                  const target = nodes.find((n) => n.id === e.target)
                  return (
                    <EdgeRow
                      key={e.id}
                      label={t.relationTypes.types[relationId]}
                      text={target?.data.text ?? ''}
                      color={C.color}
                      glyph={T.glyph}
                      onClick={() => focusNode(e.target)}
                    />
                  )
                })}
                {incoming.map((e) => {
                  const relationId = asEdgeTypeName(e.data?.type)
                  const T = RELATION_TYPES[relationId]
                  const C = RELATION_CATEGORIES[T.cat]
                  const source = nodes.find((n) => n.id === e.source)
                  return (
                    <EdgeRow
                      key={e.id}
                      label={`← ${t.relationTypes.types[relationId]}`}
                      text={source?.data.text ?? ''}
                      color={C.color}
                      glyph={T.glyph}
                      onClick={() => focusNode(e.source)}
                      dim
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action toolbar — docked footer */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '0.5px solid var(--line)',
          padding: '8px 12px',
          boxSizing: 'border-box',
        }}
      >
        <InspectorActionToolbar />
      </div>
    </InspectorPanel>
  )
}
