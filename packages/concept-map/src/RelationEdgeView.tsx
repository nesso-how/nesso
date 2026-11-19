import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BaseEdge,
  Position,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
  type InternalNode,
  type XYPosition,
} from '@xyflow/react'
import type { RelationEdge } from './types'
import { conceptNodeMinSize, relationSides } from './adapters'
import { draggedBend, relationCurve } from './relation-curve'
import { useCanvasContext, useNesso } from './store'
import { useTranslation } from './i18n'

const shift = (position: Position, offset = 0) =>
  position === Position.Top || position === Position.Bottom
    ? { x: offset, y: 0 }
    : { x: 0, y: offset }

const outward = (position: Position, distance: number) => ({
  x: position === Position.Left ? -distance : position === Position.Right ? distance : 0,
  y: position === Position.Top ? -distance : position === Position.Bottom ? distance : 0,
})

const anchorOrigin = {
  [Position.Left]: 'right',
  [Position.Right]: 'left',
  [Position.Top]: 'bottom',
  [Position.Bottom]: 'top',
}

const bounds = (node: InternalNode) => ({
  position: node.internals.positionAbsolute,
  width: node.measured.width ?? conceptNodeMinSize.width,
  height: node.measured.height ?? conceptNodeMinSize.height,
})

const pair = (start: ReturnType<typeof endpoint>, end: ReturnType<typeof endpoint>) => ({
  source: start.point,
  target: end.point,
  sourcePosition: start.side,
  targetPosition: end.side,
})

const endpoint = (
  node: InternalNode | undefined,
  side: Position | undefined,
  position: Position,
  point: XYPosition,
  offset?: number,
) => {
  const handle = node?.internals.handleBounds?.source?.find((item) => item.id === side)
  if (!node || !side || !handle) return { side: position, point }
  if (side === position && offset === undefined) return { side, point }
  const { x, y } = node.internals.positionAbsolute
  const displacement = shift(side, offset)
  const across = (start: Position, finish: Position, size: number) =>
    side === start ? 0 : side === finish ? size : size / 2
  return {
    side,
    point: {
      x: x + handle.x + across(Position.Left, Position.Right, handle.width) + displacement.x,
      y: y + handle.y + across(Position.Top, Position.Bottom, handle.height) + displacement.y,
    },
  }
}

export function RelationEdgeView({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  markerStart,
  markerEnd,
  interactionWidth,
}: EdgeProps<RelationEdge>) {
  const { store } = useCanvasContext()
  const mapId = useNesso((state) => state.workspace.activeMapId)
  const t = useTranslation()
  const { screenToFlowPosition } = useReactFlow()
  const [preview, setPreview] = useState<{ scope: string; value: number } | null>(null)
  const ref = useRef<SVGGElement>(null)
  const drag = useRef<{
    pointerId: number
    origin: { x: number; y: number }
    bend: number
    value: number
  } | null>(null)
  const bend = data?.bend ?? 0
  const editable = !!data?.editable && mapId !== null
  const sourceShift = shift(sourcePosition, data?.sourceOffset)
  const targetShift = shift(targetPosition, data?.targetOffset)
  const from = { x: sourceX + sourceShift.x, y: sourceY + sourceShift.y }
  const to = { x: targetX + targetShift.x, y: targetY + targetShift.y }
  const scope = JSON.stringify([id, mapId, bend, editable, from, to])
  if (preview && preview.scope !== scope) setPreview(null)
  const value = preview?.scope === scope ? preview.value : bend
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const sides =
    preview?.scope === scope && sourceNode && targetNode
      ? relationSides(bounds(sourceNode), bounds(targetNode), value)
      : null
  const start = endpoint(sourceNode, sides?.source, sourcePosition, from)
  const end = endpoint(targetNode, sides?.target, targetPosition, to)
  const automatic =
    sourceNode && targetNode ? relationSides(bounds(sourceNode), bounds(targetNode)) : null
  const reference = pair(
    endpoint(sourceNode, automatic?.source, sourcePosition, from, data?.sourceReferenceOffset ?? 0),
    endpoint(targetNode, automatic?.target, targetPosition, to, data?.targetReferenceOffset ?? 0),
  )
  const curve = relationCurve(pair(start, end), value, value ? reference : undefined)
  const cancel = () => {
    drag.current = null
    setPreview(null)
  }
  useEffect(() => {
    drag.current = null
  }, [scope])
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    for (const [kind, current, position, x, y] of [
      ['source', start, sourcePosition, sourceX, sourceY],
      ['target', end, targetPosition, targetX, targetY],
    ] as const) {
      const anchor = parent.querySelector<SVGCircleElement>(`.react-flow__edgeupdater-${kind}`)
      const radius = anchor?.r.baseVal.value ?? 0
      const before = outward(position, radius)
      const after = outward(current.side, radius)
      parent.style.setProperty(
        `--${kind}-offset`,
        `${current.point.x - x + after.x - before.x}px ${current.point.y - y + after.y - before.y}px`,
      )
      parent.style.setProperty(`--${kind}-origin`, anchorOrigin[current.side])
    }
  })
  const commit = (value: number) => {
    if (editable && store.getState().workspace.activeMapId === mapId)
      store.applyOperations([{ kind: 'relation.bend', id, value }])
  }
  return (
    <g ref={ref}>
      <BaseEdge
        id={id}
        path={curve.path}
        labelX={curve.midpoint.x}
        labelY={curve.midpoint.y - (editable && label ? 18 : 0)}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={style}
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
      {editable && (
        <g
          className="relation-bend-handle nodrag nopan"
          data-bend-id={id}
          transform={`translate(${curve.midpoint.x},${curve.midpoint.y})`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey
            )
              return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              pointerId: event.pointerId,
              origin: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
              bend,
              value: bend,
            }
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current || current.pointerId !== event.pointerId) return
            const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
            const delta = { x: point.x - current.origin.x, y: point.y - current.origin.y }
            const value = draggedBend(reference.source, reference.target, delta, current.bend)
            current.value = Math.abs(value) < 0.005 ? 0 : value
            setPreview({ scope, value: current.value })
          }}
          onPointerUp={(event) => {
            const current = drag.current
            if (!current || current.pointerId !== event.pointerId) return
            event.stopPropagation()
            cancel()
            if (current.value !== current.bend) commit(current.value)
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            commit(0)
          }}
        >
          <title>{t('bendInstructions')}</title>
          <circle r={12} fill="transparent" stroke="none" />
          <circle className="relation-bend-dot" r={4} />
        </g>
      )}
    </g>
  )
}
