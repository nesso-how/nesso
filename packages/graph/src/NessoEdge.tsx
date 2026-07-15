// SPDX-License-Identifier: MIT
import { useState } from 'react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { useStore } from '@xyflow/react'
import { PALETTES, RELATION_TYPES } from '@nesso-how/vocab-learning'
import type { RelationCategory, RelationTypeName } from '@nesso-how/vocab-learning'
import type { NessoEdgeData } from './display.js'
import { GlyphSVG } from './GlyphSVG.js'
import { useGraphDisplay, type NessoGraphDisplayContext } from './context.js'
import {
  arcControlPoint,
  effectiveCurveFlip,
  flowNodeCenterX,
  flowNodeCenterY,
  nessoArcPath,
  rectExit,
} from './geometry.js'

function asRelationTypeName(
  value: unknown,
  fallback: RelationTypeName = 'causes',
): RelationTypeName {
  return typeof value === 'string' && value in RELATION_TYPES
    ? (value as RelationTypeName)
    : fallback
}

function categoryColor(
  cat: RelationCategory,
  mode: 'palette' | 'css',
  palette: NessoGraphDisplayContext['palette'],
): string {
  if (mode === 'css') return `var(--cat-${cat})`
  return PALETTES[palette]?.[cat] ?? '#666666'
}

type NessoFlowEdge = Edge<NessoEdgeData, 'nesso'>

export function NessoEdge({ id, source, target, data, selected }: EdgeProps<NessoFlowEdge>) {
  const [hovered, setHovered] = useState(false)
  const {
    edgeEncoding,
    curveStyle,
    autoCurveFlip,
    palette,
    categoryColorMode,
    getRelationLabel,
    isItemSelected,
  } = useGraphDisplay()

  const sourceNode = useStore((s) => s.nodeLookup.get(source))
  const targetNode = useStore((s) => s.nodeLookup.get(target))

  const edgeType = asRelationTypeName(data?.type)
  const T = RELATION_TYPES[edgeType]
  const color =
    edgeEncoding === 'minimal'
      ? 'var(--ink-3, #888888)'
      : categoryColor(T.cat, categoryColorMode, palette)
  const isSelected = selected || isItemSelected?.('edge', id) === true
  const showLabel =
    edgeEncoding === 'full' || (edgeEncoding !== 'minimal' && (hovered || isSelected))
  const straight = curveStyle === 'straight'
  const label = getRelationLabel?.(edgeType) ?? T.label

  if (!sourceNode || !targetNode) return null

  const sw = sourceNode.measured?.width ?? 80
  const sh = sourceNode.measured?.height ?? 32
  const tw = targetNode.measured?.width ?? 80
  const th = targetNode.measured?.height ?? 32

  const scx = sourceNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(sourceNode)
  const tcx = targetNode.internals.positionAbsolute.x + tw / 2
  const tcy = flowNodeCenterY(targetNode)

  const curveFlip = effectiveCurveFlip(
    autoCurveFlip,
    data?.curveFlipPinned,
    data?.curveFlip,
    flowNodeCenterX(sourceNode),
    scy,
    flowNodeCenterX(targetNode),
    tcy,
  )

  const pad = 6
  const { a, b } = (() => {
    if (straight) {
      return {
        a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy),
        b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy),
      }
    }
    const { cpx, cpy } = arcControlPoint(scx, scy, tcx, tcy, data?.siblingIdx ?? 0, curveFlip)
    return {
      a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy),
      b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, cpx, cpy),
    }
  })()

  const { path, labelX, labelY, arrowAngle } = nessoArcPath(
    a.x,
    a.y,
    b.x,
    b.y,
    data?.siblingIdx ?? 0,
    straight,
    curveFlip,
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
      style={{ cursor: 'default' }}
    >
      <path d={path} stroke="transparent" strokeWidth={14} fill="none" />

      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={w}
        opacity={op}
        strokeLinecap="round"
      />

      {T.inverse !== 'self' && edgeEncoding !== 'minimal' && (
        <polygon points={`${b.x},${b.y} ${ax1},${ay1} ${ax2},${ay2}`} fill={color} opacity={0.85} />
      )}

      {edgeEncoding !== 'minimal' && (
        <g style={{ pointerEvents: 'all' }}>
          <circle
            cx={labelX}
            cy={labelY}
            r={r}
            fill="var(--paper, #ffffff)"
            stroke={color}
            strokeWidth={1.2}
          />
          <g transform={`translate(${labelX - 7}, ${labelY - 7})`}>
            <GlyphSVG kind={T.glyph} color={color} size={14} />
          </g>
        </g>
      )}

      {showLabel && (
        <foreignObject
          x={labelX - 60}
          y={labelY + r + 2}
          width={120}
          height={20}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              display: 'inline-block',
              background: 'var(--paper, #ffffff)',
              border: '0.5px solid var(--line, #d0d0d0)',
              borderRadius: 4,
              padding: '1px 6px',
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              lineHeight: '16px',
            }}
          >
            {label}
          </div>
        </foreignObject>
      )}
    </g>
  )
}
