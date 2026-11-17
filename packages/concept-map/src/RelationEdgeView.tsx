import { BezierEdge, Position, type EdgeProps } from '@xyflow/react'
import { useLayoutEffect, useRef } from 'react'
import type { RelationEdge } from './types'

const shift = (position: Position, offset = 0) =>
  position === Position.Top || position === Position.Bottom
    ? { x: offset, y: 0 }
    : { x: 0, y: offset }

export function RelationEdgeView({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  ...props
}: EdgeProps<RelationEdge>) {
  const ref = useRef<SVGGElement>(null)
  const source = shift(sourcePosition, data?.sourceOffset)
  const target = shift(targetPosition, data?.targetOffset)

  useLayoutEffect(() => {
    const style = ref.current?.parentElement?.style
    style?.setProperty('--source-offset', `${source.x}px ${source.y}px`)
    style?.setProperty('--target-offset', `${target.x}px ${target.y}px`)
  }, [source.x, source.y, target.x, target.y])

  return (
    <g ref={ref}>
      <BezierEdge
        {...props}
        sourceX={sourceX + source.x}
        sourceY={sourceY + source.y}
        targetX={targetX + target.x}
        targetY={targetY + target.y}
        sourcePosition={sourcePosition}
        targetPosition={targetPosition}
      />
    </g>
  )
}
