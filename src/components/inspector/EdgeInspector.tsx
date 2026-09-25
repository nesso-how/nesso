// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_CATEGORY_COLORS,
  RELATION_TYPE_VALUES,
  asRelationTypeName,
} from '@/data/relationTypes'
import { useGraphStore, selectedEdgeSelector } from '@/store'
import { useT } from '@/i18n'
import { InspectorPanel } from './InspectorPanel'
import { InspectorActionToolbar, InspectorCollapseCloseRow } from './inspectorChrome'

interface Props {
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}

export function EdgeInspector({ panelWidth, onPanelWidthChange }: Props) {
  const t = useT()
  const edge = useGraphStore(selectedEdgeSelector)!
  const fromText = useGraphStore((s) => s.nodes.find((n) => n.id === edge.source)?.data.text)
  const toText = useGraphStore((s) => s.nodes.find((n) => n.id === edge.target)?.data.text)
  const updateEdgeType = useGraphStore((s) => s.updateEdgeType)
  const edgeType = asRelationTypeName(edge.data?.type)
  const T = RELATION_TYPES[edgeType]
  const C = RELATION_CATEGORY_COLORS[T.cat]
  const siblings = RELATION_TYPE_VALUES.filter((id) => RELATION_TYPES[id].cat === T.cat)

  return (
    <InspectorPanel panelWidth={panelWidth} onPanelWidthChange={onPanelWidthChange}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '12px 14px', borderBottom: '0.5px solid var(--line)' }}>
        <InspectorCollapseCloseRow marginBottom={12} />

        {/* from / relation / to — vertical (concept names are often long) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              color: 'var(--ink)',
            }}
          >
            {fromText}
          </span>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 1, minWidth: 0 }}
          >
            <span
              data-testid="edge-current-relation"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                color: C.color,
              }}
            >
              {t.relationTypes.types[edgeType]}
            </span>
          </div>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              color: 'var(--ink)',
            }}
          >
            {toText}
          </span>
        </div>
      </div>

      {/* Scroll body */}
      <div
        className="nesso-scrollbar"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px 16px' }}
      >
        <h5
          style={{
            margin: '0 0 8px',
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-4)',
          }}
        >
          {t.inspector.sharpen}
        </h5>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {siblings.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => updateEdgeType(edge.id, k)}
              style={{
                fontSize: '11px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-pill)',
                border: `0.5px solid ${k === edgeType ? C.color : 'var(--line)'}`,
                background: k === edgeType ? C.color : 'transparent',
                color: k === edgeType ? 'var(--paper)' : 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              {t.relationTypes.types[k]}
            </button>
          ))}
        </div>
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
