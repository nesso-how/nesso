// SPDX-License-Identifier: MIT
import type { ConnectionLineComponentProps } from '@xyflow/react'
import {
  effectiveCurveFlip,
  flowNodeCenterX,
  flowNodeCenterY,
  nessoArcPath,
  rectExit,
} from '@nesso-how/graph'
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
  const autoCurveFlip = useGraphStore((s) => s.graphDisplay.autoCurveFlip)

  const sw = fromNode.measured?.width ?? 80
  const sh = fromNode.measured?.height ?? 32
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(fromNode)

  let startX = fromX
  let startY = fromY
  let b: { x: number; y: number }
  let curveFlip = false

  if (toNode) {
    const tw = toNode.measured?.width ?? 80
    const th = toNode.measured?.height ?? 32
    const tcx = toNode.internals.positionAbsolute.x + tw / 2
    const tcy = flowNodeCenterY(toNode)
    curveFlip = effectiveCurveFlip(
      autoCurveFlip,
      false,
      false,
      flowNodeCenterX(fromNode),
      scy,
      flowNodeCenterX(toNode),
      tcy,
    )
    if (straight) {
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy)
      b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy)
      startX = a.x
      startY = a.y
    } else {
      // Mirror NessoEdge: derive the control point from node centers so that
      // both exit points account for the actual curve direction (including flip).
      const flipSign = curveFlip ? -1 : 1
      const dx = tcx - scx
      const dy = tcy - scy
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / dist
      const ny = dx / dist
      const bend = Math.min(dist * 0.22, 90) * flipSign
      const cpx = (scx + tcx) / 2 + nx * bend
      const cpy = (scy + tcy) / 2 + ny * bend
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy)
      b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, cpx, cpy)
      startX = a.x
      startY = a.y
    }
  } else {
    // No target node yet: treat cursor as a virtual target so the flip direction
    // and source exit point update dynamically as the user moves the cursor.
    curveFlip = effectiveCurveFlip(
      autoCurveFlip,
      false,
      false,
      flowNodeCenterX(fromNode),
      scy,
      toX,
      toY,
    )
    b = { x: toX, y: toY }
    if (straight) {
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, toX, toY)
      startX = a.x
      startY = a.y
    } else {
      const flipSign = curveFlip ? -1 : 1
      const dx = toX - scx
      const dy = toY - scy
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / dist
      const ny = dx / dist
      const bend = Math.min(dist * 0.22, 90) * flipSign
      const cpx = (scx + toX) / 2 + nx * bend
      const cpy = (scy + toY) / 2 + ny * bend
      const a = rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy)
      startX = a.x
      startY = a.y
    }
  }

  const { path } = nessoArcPath(startX, startY, b.x, b.y, 0, straight, curveFlip)

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
