// SPDX-License-Identifier: MIT
import type { ConnectionLineComponentProps } from '@xyflow/react'
import { effectiveCurveFlip, flowNodeCenterX, flowNodeCenterY, nessoArcPath, rectExit } from '@/geometry/nessoEdgeGeometry'
import { useGraphStore } from '@/store/graph'

const pad = 6

export function NessoConnectionLine({
  fromNode,
  toNode,
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const straight = useGraphStore(s => s.graphDisplay.curveStyle === 'straight')
  const autoCurveFlip = useGraphStore(s => s.graphDisplay.autoCurveFlip)

  const sw = fromNode.measured?.width ?? 80
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(fromNode)

  let b: { x: number; y: number }
  let curveFlip = false
  if (toNode) {
    const tw = toNode.measured?.width ?? 80
    const th = toNode.measured?.height ?? 32
    const tcx = toNode.internals.positionAbsolute.x + tw / 2
    const tcy = flowNodeCenterY(toNode)
    b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy)
    curveFlip = effectiveCurveFlip(
      autoCurveFlip,
      false,
      false,
      flowNodeCenterX(fromNode),
      scy,
      flowNodeCenterX(toNode),
      tcy,
    )
  } else {
    b = { x: toX, y: toY }
  }

  const { path } = nessoArcPath(fromX, fromY, b.x, b.y, 0, straight, curveFlip)

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={2}
      opacity={0.82}
      strokeLinecap="round"
    />
  )
}
