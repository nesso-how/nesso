import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BaseEdge, Position, useReactFlow, type EdgeProps } from '@xyflow/react'
import type { RelationEdge } from './types'
import { draggedBend, relationCurve } from './relation-curve'
import { useCanvasContext, useNesso } from './store'
import { useTranslation } from './i18n'

const shift = (position: Position, offset = 0) =>
  position === Position.Top || position === Position.Bottom
    ? { x: offset, y: 0 }
    : { x: 0, y: offset }

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
  selected,
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
  const viewId = useNesso((state) => state.workspace.activeViewId)
  const t = useTranslation()
  const { screenToFlowPosition } = useReactFlow()
  const [preview, setPreview] = useState<{ scope: string; value: number } | null>(null)
  const keyHistory = useRef<string | undefined>(undefined)
  const ref = useRef<SVGGElement>(null)
  const drag = useRef<{
    pointerId: number
    origin: { x: number; y: number }
    bend: number
    value: number
  } | null>(null)
  const bend = data?.bend ?? 0
  const editable =
    !!data?.editable && selected && !data.relations && source !== target && viewId !== null
  const sourceShift = shift(sourcePosition, data?.sourceOffset)
  const targetShift = shift(targetPosition, data?.targetOffset)
  const from = { x: sourceX + sourceShift.x, y: sourceY + sourceShift.y }
  const to = { x: targetX + targetShift.x, y: targetY + targetShift.y }
  const scope = JSON.stringify([id, viewId, bend, editable, from, to])
  if (preview && preview.scope !== scope) setPreview(null)
  const value = preview?.scope === scope ? preview.value : bend
  const curve = relationCurve({ source: from, target: to, sourcePosition, targetPosition }, value)
  const cancel = () => {
    drag.current = null
    setPreview(null)
  }
  useEffect(() => {
    drag.current = null
  }, [scope])
  useLayoutEffect(() => {
    const style = ref.current?.parentElement?.style
    style?.setProperty('--source-offset', `${sourceShift.x}px ${sourceShift.y}px`)
    style?.setProperty('--target-offset', `${targetShift.x}px ${targetShift.y}px`)
  }, [sourceShift.x, sourceShift.y, targetShift.x, targetShift.y])
  const commit = (value: number, historyGroup?: string) => {
    if (!editable || store.getState().workspace.activeViewId !== viewId || !viewId) return
    store.applyOperations([{ kind: 'relation.bend', id, value }], { historyGroup })
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
          role="spinbutton"
          aria-label={t('bendRelation')}
          aria-valuenow={value}
          tabIndex={0}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            commit(0)
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.focus()
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
            const value = draggedBend(from, to, delta, current.bend)
            current.value = Math.abs(value) < 0.005 ? 0 : value
            setPreview({ scope, value: current.value })
          }}
          onPointerUp={(event) => {
            const current = drag.current
            if (!current || current.pointerId !== event.pointerId) return
            event.stopPropagation()
            cancel()
            commit(current.value)
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && drag.current) {
              event.preventDefault()
              event.stopPropagation()
              cancel()
              return
            }
            if (event.altKey || event.ctrlKey || event.metaKey) return
            const direction = ['ArrowUp', 'ArrowRight'].includes(event.key)
              ? 1
              : ['ArrowDown', 'ArrowLeft'].includes(event.key)
                ? -1
                : 0
            if (!direction && event.key !== 'Home') return
            event.preventDefault()
            event.stopPropagation()
            const value = direction ? bend + direction * (event.shiftKey ? 0.1 : 0.025) : 0
            if (!event.repeat) keyHistory.current = crypto.randomUUID()
            commit(Math.abs(value) < 0.005 ? 0 : value, direction ? keyHistory.current : undefined)
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
