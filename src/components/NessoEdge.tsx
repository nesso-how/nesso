// SPDX-License-Identifier: MIT
import { useState } from 'react'
import type { EdgeProps } from '@xyflow/react'
import { useStore } from '@xyflow/react'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import type { EdgeTypeName, EdgeEncoding } from '@/types/graph'
import { useGraphStore } from '@/store/graph'
import { nessoArcPath, rectExit } from '@/geometry/nessoEdgeGeometry'

export interface NessoEdgeData {
  type: EdgeTypeName
  siblingIdx?: number   // 0-based index among edges sharing the same node pair
  straight?: boolean    // override per edge (unused, controlled by settings)
}

function EdgePathElement({
  d,
  color,
  lineStyle,
  width = 1.5,
  opacity = 0.78,
}: {
  d: string
  color: string
  lineStyle: string
  width?: number
  opacity?: number
}) {
  const base = { fill: 'none', stroke: color, strokeWidth: width, opacity, strokeLinecap: 'round' as const }

  if (lineStyle === 'double') {
    return (
      <g>
        <path d={d} fill="none" stroke="var(--paper)" strokeWidth={width + 3} opacity={1} />
        <path d={d} {...base} strokeWidth={width * 2.6} />
        <path d={d} fill="none" stroke="var(--paper)" strokeWidth={width * 0.7} opacity={1} />
      </g>
    )
  }
  if (lineStyle === 'wavy') {
    return (
      <g>
        <path d={d} {...base} strokeDasharray="1 4" strokeWidth={width * 1.2} />
        <path d={d} {...base} strokeDasharray="1 4" strokeWidth={width * 1.2}
          transform="translate(0,2)" opacity={(opacity ?? 0.78) * 0.55} />
      </g>
    )
  }
  if (lineStyle === 'dashed') return <path d={d} {...base} strokeDasharray="6 5" />
  if (lineStyle === 'dotted') return <path d={d} {...base} strokeDasharray="0.1 5" strokeWidth={width * 1.4} />
  return <path d={d} {...base} />
}

export function NessoEdge({ id, source, target, data, selected }: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { settings, selected: storeSelected, setSelected } = useGraphStore()

  // Read live node geometry from the React Flow store so we can compute
  // bounding-box exit points instead of relying on fixed left/right handles.
  const sourceNode = useStore(s => s.nodeLookup.get(source))
  const targetNode = useStore(s => s.nodeLookup.get(target))

  const edgeData = (data as unknown) as NessoEdgeData
  const edgeType = edgeData?.type ?? 'causes'
  const T = EDGE_TYPES[edgeType]
  const C = EDGE_CATEGORIES[T.cat]
  const encoding: EdgeEncoding = settings.edgeEncoding

  const color = encoding === 'minimal' ? 'var(--ink-3)' : C.color
  const lineStyle = encoding === 'minimal' ? 'solid' : T.line
  const isSelected = selected || (storeSelected?.kind === 'edge' && storeSelected.id === id)
  const showLabel = encoding === 'full' || (encoding !== 'minimal' && (hovered || isSelected))
  const straight = settings.curveStyle === 'straight'

  if (!sourceNode || !targetNode) return null

  // Node dimensions (React Flow measures them after first render)
  const sw = sourceNode.measured?.width ?? 80
  const sh = sourceNode.measured?.height ?? 32
  const tw = targetNode.measured?.width ?? 80
  const th = targetNode.measured?.height ?? 32

  // Node centers in graph coordinates
  const scx = sourceNode.internals.positionAbsolute.x + sw / 2
  const scy = sourceNode.internals.positionAbsolute.y + sh / 2
  const tcx = targetNode.internals.positionAbsolute.x + tw / 2
  const tcy = targetNode.internals.positionAbsolute.y + th / 2

  // Exit points: slightly padded so the arrow tip clears the node border
  const pad = 6
  const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy)
  const b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy)

  const { path, labelX, labelY, arrowAngle } = nessoArcPath(
    a.x, a.y,
    b.x, b.y,
    edgeData?.siblingIdx ?? 0,
    straight,
  )

  const arrowSize = 7
  const a1 = arrowAngle + Math.PI - 0.45
  const a2 = arrowAngle + Math.PI + 0.45
  const ax1 = b.x + Math.cos(a1) * arrowSize
  const ay1 = b.y + Math.sin(a1) * arrowSize
  const ax2 = b.x + Math.cos(a2) * arrowSize
  const ay2 = b.y + Math.sin(a2) * arrowSize

  const w = isSelected ? 2 : 1.4
  const op = isSelected || hovered ? 1 : 0.78
  const r = 11

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); setSelected({ kind: 'edge', id }) }}
      style={{ cursor: 'default' }}
    >
      {/* Wide invisible hit area */}
      <path d={path} stroke="transparent" strokeWidth={14} fill="none" />

      <EdgePathElement d={path} color={color} lineStyle={lineStyle} width={w} opacity={op} />

      {/* Arrowhead at the bbox exit point of the target node */}
      {!T.symmetric && encoding !== 'minimal' && (
        <polygon
          points={`${b.x},${b.y} ${ax1},${ay1} ${ax2},${ay2}`}
          fill={color}
          opacity={0.85}
        />
      )}

      {/* Midpoint glyph chip */}
      {encoding !== 'minimal' && (
        <g style={{ pointerEvents: 'all' }}>
          <circle cx={labelX} cy={labelY} r={r} fill="var(--paper)" stroke={color} strokeWidth={1.2} />
          <g transform={`translate(${labelX - 7}, ${labelY - 7})`}>
            <GlyphSVG kind={T.glyph} color={color} size={14} />
          </g>
        </g>
      )}

      {/* Label */}
      {showLabel && (
        <foreignObject
          x={labelX - 60}
          y={labelY + r + 2}
          width={120}
          height={20}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div style={{
            display: 'inline-block',
            background: 'var(--paper)',
            border: '0.5px solid var(--line)',
            borderRadius: 4,
            padding: '1px 6px',
            font: "500 10px 'JetBrains Mono', ui-monospace",
            color,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            lineHeight: '16px',
          }}>
            {T.label}
          </div>
        </foreignObject>
      )}
    </g>
  )
}
