// SPDX-License-Identifier: MIT
import type { ConnectionLineComponentProps } from '@xyflow/react'
import { arcControlPoint, flowNodeCenterY, nessoArcPath, rectExit } from '@nesso-how/graph'
import { useGraphStore } from '@/store'

const pad = 6

export function NessoConnectionLine({
  fromNode,
  toNode,
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const straight = useGraphStore((s) => s.graphDisplay.curveStyle === 'straight')

  const sw = fromNode.measured?.width ?? 80
  const sh = fromNode.measured?.height ?? 32
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(fromNode)

  let startX = fromX
  let startY = fromY
  let b: { x: number; y: number }

  if (toNode) {
    const tw = toNode.measured?.width ?? 80
    const th = toNode.measured?.height ?? 32
    const tcx = toNode.internals.positionAbsolute.x + tw / 2
    const tcy = flowNodeCenterY(toNode)
    if (straight) {
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy)
      b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy)
      startX = a.x
      startY = a.y
    } else {
      // Mirror NessoEdge: derive the control point from node centers so that
      // both exit points account for the actual curve direction. The preview
      // always uses the default bow; custom offsets belong to saved edges.
      const { cpx, cpy } = arcControlPoint(scx, scy, tcx, tcy, 0)
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy)
      b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, cpx, cpy)
      startX = a.x
      startY = a.y
    }
  } else {
    // No target node yet: treat the cursor as a virtual target so the source
    // exit point follows it dynamically.
    b = { x: toX, y: toY }
    if (straight) {
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, toX, toY)
      startX = a.x
      startY = a.y
    } else {
      const { cpx, cpy } = arcControlPoint(scx, scy, toX, toY, 0)
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy)
      startX = a.x
      startY = a.y
    }
  }

  const { path } = nessoArcPath(startX, startY, b.x, b.y, 0, straight)

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray={'0.5 3'}
      opacity={toNode ? 0.65 : 0.25}
      strokeLinecap="round"
    />
  )
}
