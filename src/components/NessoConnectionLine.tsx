// SPDX-License-Identifier: AGPL-3.0
import type { ConnectionLineComponentProps } from '@xyflow/react'
import { nessoArcPath, rectExit } from '@/geometry/nessoEdgeGeometry'
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
  const straight = useGraphStore(s => s.settings.curveStyle === 'straight')

  const sw = fromNode.measured?.width ?? 80
  const sh = fromNode.measured?.height ?? 32
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = fromNode.internals.positionAbsolute.y + sh / 2

  let b: { x: number; y: number }
  if (toNode) {
    const tw = toNode.measured?.width ?? 80
    const th = toNode.measured?.height ?? 32
    const tcx = toNode.internals.positionAbsolute.x + tw / 2
    const tcy = toNode.internals.positionAbsolute.y + th / 2
    b = rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy)
  } else {
    b = { x: toX, y: toY }
  }

  const { path } = nessoArcPath(fromX, fromY, b.x, b.y, 0, straight)

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
