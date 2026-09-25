// SPDX-License-Identifier: MIT
import { useLayoutEffect } from 'react'
import { useReactFlow, type ConnectionLineComponentProps, type Node } from '@xyflow/react'
import {
  attachmentAt,
  connectionPreview,
  flowNodeCenterY,
  PREVIEW_DASHARRAY,
} from '@nesso-how/graph'
import { useGraphStore } from '@/store'

/** Concept under the cursor, if any, excluding the drag origin. */
export function hoveredNode(
  nodes: Node[],
  fromId: string,
  cursor: { x: number; y: number },
): Node | undefined {
  return nodes.find((node) => node.id !== fromId && insideNode(node, cursor))
}

export function insideNode(node: Node, cursor: { x: number; y: number }): boolean {
  const w = node.measured?.width ?? 80
  const h = node.measured?.height ?? 32
  return (
    cursor.x >= node.position.x &&
    cursor.x <= node.position.x + w &&
    cursor.y >= node.position.y &&
    cursor.y <= node.position.y + h
  )
}

/** Padded flow box of the drop destination. Nesso concepts are flat, so
 * position is flow-absolute. */
export function destinationBoxOf(destination: Node) {
  const w = destination.measured?.width ?? 80
  const h = destination.measured?.height ?? 32
  return {
    cx: destination.position.x + w / 2,
    cy: destination.position.y + h / 2,
    w,
    h,
  }
}

/** styleEdges fans siblings in insertion order; the new edge is appended. */
export function siblingCount(
  edges: { source: string; target: string }[],
  fromId: string,
  toId: string,
) {
  return edges.filter(
    (e) => (e.source === fromId && e.target === toId) || (e.source === toId && e.target === fromId),
  ).length
}

export function NessoConnectionLine({
  fromNode,
  toNode,
  toX,
  toY,
  pointer,
  onPreviewAttachment,
}: ConnectionLineComponentProps & {
  onPreviewAttachment?: (nodeId: string | null, attachment?: { x: number; y: number }) => void
}) {
  const straight = useGraphStore((s) => s.graphDisplay.curveStyle === 'straight')
  const { getEdges, getNodes, screenToFlowPosition } = useReactFlow()
  // React Flow's `pointer` is canvas-relative screen pixels; `toX/toY`
  // may already be snapped to a handle, so recover the unsnapped flow point.
  const canvasBounds = document.querySelector('.react-flow')?.getBoundingClientRect()
  const cursor = canvasBounds
    ? screenToFlowPosition({ x: canvasBounds.left + pointer.x, y: canvasBounds.top + pointer.y })
    : { x: toX, y: toY }
  const sw = fromNode.measured?.width ?? 80
  const sh = fromNode.measured?.height ?? 32
  const scx = fromNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(fromNode)

  const hovered = hoveredNode(getNodes(), fromNode.id, cursor)
  const destination = hovered ?? (toNode?.id !== fromNode.id ? toNode : null)
  const destinationBox = destination ? destinationBoxOf(destination) : null
  const siblingIdx = destination ? siblingCount(getEdges(), fromNode.id, destination.id) : 0
  const targetAttachment = destinationBox ? attachmentAt(destinationBox, cursor) : undefined
  useLayoutEffect(() => {
    onPreviewAttachment?.(destination?.id ?? null, targetAttachment)
  }, [onPreviewAttachment, destination?.id, targetAttachment])
  const { path, snapped } = connectionPreview(
    scx,
    scy,
    sw,
    sh,
    toX,
    toY,
    destinationBox,
    straight,
    1,
    siblingIdx,
    targetAttachment,
  )

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray={PREVIEW_DASHARRAY}
      opacity={snapped ? 0.65 : 0.25}
      strokeLinecap="round"
    />
  )
}
