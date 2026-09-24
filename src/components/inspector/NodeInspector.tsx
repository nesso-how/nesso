// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { RelationTypeName } from '@nesso-how/vocab-learning'
import type { ConceptNodeData } from '@/types/graph'
import { RELATION_TYPES, RELATION_CATEGORY_COLORS, asRelationTypeName } from '@/data/relationTypes'
import { withDefinition } from '@/lib/elaboration'
import { useGraphStore, selectedNodeSelector } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { useT } from '@/i18n'
import { InlineEdit } from './InlineEdit'
import { WritingEditor } from '@/components/writing/WritingEditor'
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

function blurActiveElement(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

type MemoryRow = { label: string; value: string; accent?: boolean; warn?: boolean }

function MemorySection({
  open,
  rows,
  title,
  onToggle,
}: {
  open: boolean
  rows: MemoryRow[]
  title: string
  onToggle: () => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 0,
          marginBottom: open ? 11 : 0,
          ...LABEL_STYLE,
        }}
      >
        <span>{title}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row, index) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-6)',
                padding: '7px 0',
                borderBottom: index === rows.length - 1 ? 'none' : '0.5px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-3)',
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  color: row.accent
                    ? 'var(--highlight)'
                    : row.warn
                      ? 'var(--cat-opposition)'
                      : 'var(--ink-2)',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RelationRows({
  edges,
  incoming,
  nodes,
  relationLabel,
  onFocus,
}: {
  edges: Edge[]
  incoming?: boolean
  nodes: Node<ConceptNodeData>[]
  relationLabel: (id: RelationTypeName) => string
  onFocus: (id: string) => void
}) {
  return (
    <>
      {edges.map((edge) => {
        const relationId = asRelationTypeName(edge.data?.type)
        const relation = RELATION_TYPES[relationId]
        const color = RELATION_CATEGORY_COLORS[relation.cat].color
        const relatedNodeId = incoming ? edge.source : edge.target
        const relatedNode = nodes.find((node) => node.id === relatedNodeId)
        return (
          <EdgeRow
            key={edge.id}
            label={`${incoming ? '← ' : ''}${relationLabel(relationId)}`}
            text={relatedNode?.data.text ?? ''}
            color={color}
            onClick={() => onFocus(relatedNodeId)}
            dim={incoming}
          />
        )
      })}
    </>
  )
}

function RelationsSection({
  outgoing,
  incoming,
  nodes,
  open,
  title,
  relationLabel,
  onFocus,
  onToggle,
}: {
  outgoing: Edge[]
  incoming: Edge[]
  nodes: Node<ConceptNodeData>[]
  open: boolean
  title: string
  relationLabel: (id: RelationTypeName) => string
  onFocus: (id: string) => void
  onToggle: () => void
}) {
  if (outgoing.length === 0 && incoming.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <button
        type="button"
        onClick={onToggle}
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
        <span>{title}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <RelationRows
            edges={outgoing}
            nodes={nodes}
            relationLabel={relationLabel}
            onFocus={onFocus}
          />
          <RelationRows
            edges={incoming}
            incoming
            nodes={nodes}
            relationLabel={relationLabel}
            onFocus={onFocus}
          />
        </div>
      )}
    </div>
  )
}

function useNodeInspectorState() {
  const t = useT()
  const node = useGraphStore(selectedNodeSelector)!
  const nodeId = node.id
  // Shallow-compared derived collections: element refs are preserved by store
  // mutations for untouched edges/nodes, so unrelated updates skip re-render.
  const outgoing = useGraphStore(useShallow((s) => s.edges.filter((e) => e.source === nodeId)))
  const incoming = useGraphStore(useShallow((s) => s.edges.filter((e) => e.target === nodeId)))
  const relatedNodes = useGraphStore(
    useShallow((s) => {
      const ids = new Set<string>()
      for (const edge of s.edges) {
        if (edge.source === nodeId) ids.add(edge.target)
        else if (edge.target === nodeId) ids.add(edge.source)
      }
      return s.nodes.filter((n) => ids.has(n.id))
    }),
  )
  const setSelected = useGraphStore((s) => s.setSelected)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const memoryOpen = useGraphStore((s) => s.settings.inspectorMemoryOpen)
  const relationsOpen = useGraphStore((s) => s.settings.inspectorRelationsOpen)
  const setSetting = useGraphStore((s) => s.setSetting)

  return {
    t,
    node,
    outgoing,
    incoming,
    relatedNodes,
    setSelected,
    updateNodeData,
    memoryOpen,
    relationsOpen,
    setSetting,
  }
}

function InlineNotes({ node }: { node: Node<ConceptNodeData> }) {
  const t = useT()
  const elab = node.data.elaboration
  const updateNodeNotes = useGraphStore((s) => s.updateNodeNotes)
  const writingModeNodeId = useGraphStore((s) => s.writingModeNodeId)
  const openWritingMode = useGraphStore((s) => s.openWritingMode)

  // Only one live editor may own the notes while Writing Mode is open. Notes
  // longer than the preview height scroll inside their own clipped container.
  return (
    <>
      {writingModeNodeId !== node.id && (
        <div
          data-testid="inspector-notes-inline"
          className="inspector-notes-inline nesso-scrollbar"
          style={{ marginTop: 12, maxHeight: 396, overflowY: 'auto' }}
        >
          <WritingEditor
            key={node.id}
            identityKey={node.id}
            definition={elab?.definition ?? ''}
            placeholder={t.writing.placeholder}
            initialNotes={elab?.notes}
            onCommit={(notes) => updateNodeNotes(node.id, notes)}
            onEscape={blurActiveElement}
            autoFocus={false}
            invalidNotesMessage={t.writing.invalidNotes}
            snippets={t.writing.snippets}
            menuLabel={t.writing.snippetsMenu}
          />
        </div>
      )}

      <button
        type="button"
        data-testid="inspector-notes-write"
        className="inspector-notes-write"
        onClick={() => openWritingMode(node.id)}
        style={{
          appearance: 'none',
          border: '0.5px solid var(--line)',
          color: 'var(--ink-2)',
          fontSize: '12.5px',
          fontWeight: 'var(--font-weight-medium)',
          fontFamily: 'var(--font-sans)',
          padding: 'var(--space-2) var(--space-5)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          width: '100%',
          marginTop: 8,
        }}
      >
        {t.inspector.notes.openNote}
      </button>
    </>
  )
}

function ElaborationSection({ node }: { node: Node<ConceptNodeData> }) {
  const t = useT()
  const elab = node.data.elaboration
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const elaborationOpen = useGraphStore((s) => s.settings.inspectorElaborationOpen)
  const setSetting = useGraphStore((s) => s.setSetting)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)

  const patch = (definition: string) =>
    updateNodeData(node.id, { elaboration: withDefinition(elab, definition) })

  return (
    <div data-testid="inspector-elaboration-section">
      <button
        type="button"
        onClick={() => setSetting('inspectorElaborationOpen', !elaborationOpen)}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 0,
          marginBottom: elaborationOpen ? 11 : 0,
          width: '100%',
          ...LABEL_STYLE,
        }}
      >
        <span>{t.inspector.notes.elaboration}</span>
        <Chevron open={elaborationOpen} />
      </button>
      {elaborationOpen && (
        <>
          <div
            data-onboarding={
              isOnboardingStep(onboardingStep, 'inspector-definition') && node.id === firstNodeId
                ? 'inspector-definition'
                : undefined
            }
          >
            <InlineEdit
              value={elab?.definition ?? ''}
              placeholder={t.inspector.notes.definitionPlaceholder}
              onSave={(v) => patch(v)}
              multiline
              noEditBorder
              maxLength={2000}
              /* Matches the inline notes surface: display font, ink text,
                 normal leading, no padding. Empty text uses the shared ink-5 hint. */
              textStyle={{
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: 'var(--leading-normal)',
                fontFamily: 'var(--font-display)',
                color: 'var(--ink)',
              }}
            />
          </div>

          <div style={{ borderTop: '0.5px solid var(--line)', marginTop: 12 }} />

          <InlineNotes node={node} />
        </>
      )}
    </div>
  )
}

export function NodeInspector({
  panelWidth,
  onPanelWidthChange,
}: {
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const {
    t,
    node,
    outgoing,
    incoming,
    relatedNodes,
    setSelected,
    updateNodeData,
    memoryOpen,
    relationsOpen,
    setSetting,
  } = useNodeInspectorState()

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
  const memRows: MemoryRow[] = [
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
        <MemorySection
          open={memoryOpen}
          rows={memRows}
          title={t.inspector.memory.title}
          onToggle={() => setSetting('inspectorMemoryOpen', !memoryOpen)}
        />

        {/* Relations — collapsible */}
        <RelationsSection
          outgoing={outgoing}
          incoming={incoming}
          nodes={relatedNodes}
          open={relationsOpen}
          title={t.inspector.relations}
          relationLabel={(id) => t.relationTypes.types[id]}
          onFocus={focusNode}
          onToggle={() => setSetting('inspectorRelationsOpen', !relationsOpen)}
        />

        <ElaborationSection key={node.id} node={node} />
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
