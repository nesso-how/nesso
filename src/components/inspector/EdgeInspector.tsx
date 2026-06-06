// SPDX-License-Identifier: MIT
import {
  RELATION_TYPES,
  RELATION_CATEGORIES,
  RELATION_TYPE_VALUES,
  asEdgeTypeName,
} from '@/data/relationTypes'
import { GlyphSVG } from '@/components/GlyphSVG'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SettingRow } from '@/components/ui/SettingRow'
import { useGraphStore, selectedEdgeSelector } from '@/store/graph'
import { useT } from '@/i18n'
import { InspectorPanel } from './InspectorPanel'

interface Props {
  leftOffset: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}

export function EdgeInspector({ leftOffset, panelWidth, onPanelWidthChange }: Props) {
  const t = useT()
  const edge = useGraphStore(selectedEdgeSelector)!
  const nodes = useGraphStore((s) => s.nodes)
  const updateEdgeType = useGraphStore((s) => s.updateEdgeType)
  const setEdgeCurveFlipMode = useGraphStore((s) => s.setEdgeCurveFlipMode)
  const graphDisplay = useGraphStore((s) => s.graphDisplay)
  const edgeType = asEdgeTypeName(edge.data?.type)
  const T = RELATION_TYPES[edgeType]
  const C = RELATION_CATEGORIES[T.cat]
  const from = nodes.find((n) => n.id === edge.source)
  const to = nodes.find((n) => n.id === edge.target)
  const siblings = RELATION_TYPE_VALUES.filter((id) => RELATION_TYPES[id].cat === T.cat)
  const autoCurveFlip = graphDisplay.autoCurveFlip
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
  const showCurveFlip = graphDisplay.curveStyle === 'arc'

  return (
    <InspectorPanel
      leftOffset={leftOffset}
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <div
        style={{
          font: "500 10.5px 'JetBrains Mono', ui-monospace",
          color: 'var(--ink-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{t.inspector.relation}</span>
        <span style={{ color: C.color }}>{t.relationTypes.categories[T.cat].label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 18px' }}>
        <span style={{ font: "500 13.5px 'Fraunces', serif" }}>{from?.data.text}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              height: 1,
              flex: 1,
              background: C.color,
              opacity: 0.5,
              display: 'inline-block',
            }}
          />
          <GlyphSVG kind={T.glyph} color={C.color} size={14} />
          <span
            style={{
              height: 1,
              flex: 1,
              background: C.color,
              opacity: 0.5,
              display: 'inline-block',
            }}
          />
        </div>
        <span style={{ font: "500 13.5px 'Fraunces', serif" }}>{to?.data.text}</span>
      </div>

      <div
        style={{
          font: "500 18px 'JetBrains Mono', ui-monospace",
          color: C.color,
          marginBottom: 12,
        }}
      >
        {t.relationTypes.types[edgeType]}
      </div>

      <h5
        style={{
          margin: '14px 0 6px',
          font: "600 10px 'JetBrains Mono', ui-monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-4)',
        }}
      >
        {t.inspector.sharpen}
      </h5>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {siblings.map((k) => (
          <button
            key={k}
            type="button"
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
            {t.relationTypes.types[k]}
          </button>
        ))}
      </div>

      {showCurveFlip && (
        <>
          <h5
            style={{
              margin: '18px 0 6px',
              font: "600 10px 'JetBrains Mono', ui-monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-4)',
            }}
          >
            {t.inspector.visualization}
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
    </InspectorPanel>
  )
}
