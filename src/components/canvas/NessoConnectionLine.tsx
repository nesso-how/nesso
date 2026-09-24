// SPDX-License-Identifier: MIT
import type { ConnectionLineComponentProps } from '@xyflow/react'
import { connectionPreview, flowNodeCenterY } from '@nesso-how/graph'
import { useGraphStore } from '@/store'

export function NessoConnectionLine({ fromNode, toNode, toX, toY }: ConnectionLineComponentProps) {
  const straight = useGraphStore((s) => s.graphDisplay.curveStyle === 'straight')

  const sw = fromNode.measured?.width ?? 80
  const sh = fromNode.measured?.height ?? 32
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(fromNode)

  // Shared with the endpoint-reconnect preview so both look exactly alike:
  // default bow, accent dashed stroke, faint while free, stronger on snap.
  const { path, snapped } = connectionPreview(
    scx,
    scy,
    sw,
    sh,
    toX,
    toY,
    toNode
      ? {
          cx: toNode.internals.positionAbsolute.x + (toNode.measured?.width ?? 80) / 2,
          cy: flowNodeCenterY(toNode),
          w: toNode.measured?.width ?? 80,
          h: toNode.measured?.height ?? 32,
        }
      : null,
    straight,
  )

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray={'0.5 3'}
      opacity={snapped ? 0.65 : 0.25}
      strokeLinecap="round"
    />
  )
}
