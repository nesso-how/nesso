// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_CATEGORIES,
  RELATION_TYPE_VALUES,
  asEdgeTypeName,
} from '@/data/relationTypes'
import type { Node } from '@xyflow/react'
import { GlyphSVG } from '@nesso-how/graph'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SettingRow } from '@/components/ui/SettingRow'
import { useGraphStore, selectedEdgeSelector, type GraphState } from '@/store'
import type { ConceptNodeData } from '@/types/graph'
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
  const nodes: Node<ConceptNodeData>[] = useGraphStore((s: GraphState) => s.nodes)
  const updateEdgeType = useGraphStore((s) => s.updateEdgeType)
  const setEdgeCurveFlipMode = useGraphStore((s) => s.setEdgeCurveFlipMode)
  const curveStyle = useGraphStore((s) => s.graphDisplay.curveStyle)
  const autoCurveFlip = useGraphStore((s) => s.graphDisplay.autoCurveFlip)
  const edgeType = asEdgeTypeName(edge.data?.type)
  const T = RELATION_TYPES[edgeType]
  const C = RELATION_CATEGORIES[T.cat]
  const from = nodes.find((n) => n.id === edge.source)
  const to = nodes.find((n) => n.id === edge.target)
  const siblings = RELATION_TYPE_VALUES.filter((id) => RELATION_TYPES[id].cat === T.cat)
  const curveFlipPinned = Boolean(edge.data?.curveFlipPinned)
  const curveFlipMode = autoCurveFlip
    ? curveFlipPinned
      ? edge.data?.curveFlip
        ? 'on'
        : 'off'
      : 'auto'
    : edge.data?.curveFlip
      ? 'on'
      : 'off'
  const showCurveFlip = curveStyle === 'arc'

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
            {from?.data.text}
          </span>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 1, minWidth: 0 }}
          >
            <GlyphSVG kind={T.glyph} color={C.color} size={14} />
            <span
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
            {to?.data.text}
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
                cursor: 'default',
              }}
            >
              {t.relationTypes.types[k]}
            </button>
          ))}
        </div>

        {showCurveFlip && (
          <>
            <h5
              style={{
                margin: '18px 0 6px',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ink-4)',
              }}
            >
              {t.sidebar.display}
            </h5>
            <SettingRow label={t.inspector.flipCurve}>
              <SegmentedControl
                options={
                  autoCurveFlip
                    ? [
                        { id: 'off', label: t.sidebar.displayOptions.off },
                        { id: 'auto', label: t.inspector.flipCurveAuto },
                        { id: 'on', label: t.sidebar.displayOptions.on },
                      ]
                    : [
                        { id: 'off', label: t.sidebar.displayOptions.off },
                        { id: 'on', label: t.sidebar.displayOptions.on },
                      ]
                }
                value={curveFlipMode}
                onChange={(v) => {
                  if (v !== curveFlipMode) setEdgeCurveFlipMode(edge.id, v as 'auto' | 'off' | 'on')
                }}
              />
            </SettingRow>
          </>
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
