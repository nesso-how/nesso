import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { RelationEdge } from './types'
import { useNesso } from './store'

export function RelationEdgeView(props: EdgeProps<RelationEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data } =
    props
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const label = useNesso((state) => {
    const vocab = state.vocabs.find((item) => item.id === state.preferences.activeVocabId)
    if (data?.relationId === vocab?.defaultTypeId) return ''
    return state.graph.relationTypes.find((item) => item.id === data?.relationId)?.label ?? ''
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: 'var(--muted-foreground)', strokeWidth: 2 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded border bg-popover px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
