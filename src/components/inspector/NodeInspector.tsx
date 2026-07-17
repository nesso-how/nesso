// SPDX-License-Identifier: MIT
import { type CSSProperties } from 'react'
import { RELATION_TYPES, RELATION_CATEGORY_COLORS, asRelationTypeName } from '@/data/relationTypes'
import { useGraphStore, selectedNodeSelector } from '@/store'
import { useT } from '@/i18n'
import { InlineEdit } from './InlineEdit'
import { InspectorPanel } from './InspectorPanel'
import { EdgeRow } from './EdgeRow'
import { InspectorActionToolbar, InspectorCollapseCloseRow } from './inspectorChrome'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'

const LABEL_STYLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
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
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)

  const memoryOpen = settings.inspectorMemoryOpen
  const relationsOpen = settings.inspectorRelationsOpen

  const elab = node.data.elaboration

  const patch = (definition: string) =>
    updateNodeData(node.id, {
      elaboration: { definition },
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

  return (
    <InspectorPanel panelWidth={panelWidth} onPanelWidthChange={onPanelWidthChange}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 14px',
          borderBottom: '0.5px solid var(--line)',
        }}
      >
        <InspectorCollapseCloseRow marginBottom={10} />
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
              fontSize: '18px',
              fontWeight: 500,
              lineHeight: 1.2,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}
          />
        </div>
      </div>

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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
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
                    gap: 'var(--space-6)',
                    padding: '7px 0',
                    borderBottom: i === memRows.length - 1 ? 'none' : '0.5px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {r.label}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'var(--font-mono)',
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
        <div
          data-onboarding={
            isOnboardingStep(onboardingStep, 'inspector-definition') && node.id === firstNodeId
              ? 'inspector-definition'
              : undefined
          }
        >
          <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>{t.inspector.notes.definition}</div>
          <InlineEdit
            value={elab?.definition ?? ''}
            placeholder={t.inspector.notes.definitionPlaceholder}
            onSave={(v) => patch(v)}
            multiline
            noEditBorder
            borderedPlaceholder
            maxLength={2000}
            textStyle={{
              fontSize: '13.5px',
              fontWeight: 400,
              lineHeight: 1.55,
              fontFamily: 'var(--font-display)',
              color: 'var(--ink-2)',
            }}
          />
        </div>

        {/* Relations — collapsible */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => setSetting('inspectorRelationsOpen', !relationsOpen)}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
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
                  const relationId = asRelationTypeName(e.data?.type)
                  const T = RELATION_TYPES[relationId]
                  const C = RELATION_CATEGORY_COLORS[T.cat]
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
                  const relationId = asRelationTypeName(e.data?.type)
                  const T = RELATION_TYPES[relationId]
                  const C = RELATION_CATEGORY_COLORS[T.cat]
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
