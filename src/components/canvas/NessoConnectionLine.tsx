// SPDX-License-Identifier: MIT
import { useLayoutEffect } from 'react'
import { useReactFlow, type ConnectionLineComponentProps } from '@xyflow/react'
import { attachmentAt, connectionPreview, flowNodeCenterY } from '@nesso-how/graph'
import { useGraphStore } from '@/store'

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

  const hovered = getNodes().find((node) => {
    if (node.id === fromNode.id) return false
    const w = node.measured?.width ?? 80
    const h = node.measured?.height ?? 32
    return (
      cursor.x >= node.position.x &&
      cursor.x <= node.position.x + w &&
      cursor.y >= node.position.y &&
      cursor.y <= node.position.y + h
    )
  })
  const destination = hovered ?? (toNode?.id !== fromNode.id ? toNode : null)
  // Nesso concepts are flat, so position is flow-absolute.
  const destinationBox = destination
    ? {
        cx: destination.position.x + (destination.measured?.width ?? 80) / 2,
        cy: destination.position.y + (destination.measured?.height ?? 32) / 2,
        w: destination.measured?.width ?? 80,
        h: destination.measured?.height ?? 32,
      }
    : null
  // styleEdges fans siblings in insertion order; the new edge is appended.
  const siblingIdx = destination
    ? getEdges().filter(
        (e) =>
          (e.source === fromNode.id && e.target === destination.id) ||
          (e.source === destination.id && e.target === fromNode.id),
      ).length
    : 0
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
      strokeDasharray={'0.5 3'}
      opacity={snapped ? 0.65 : 0.25}
      strokeLinecap="round"
    />
  )
}
