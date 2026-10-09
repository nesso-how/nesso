import { BezierEdge, Position, type ConnectionLineComponentProps, type InternalNode } from '@xyflow/react'
import { facingSide } from './adapters'

const bounds = (node: InternalNode) => ({ position: node.internals.positionAbsolute, width: node.measured.width!, height: node.measured.height! })

const anchor = (node: InternalNode, side: Position) => {
  const handle = node.internals.handleBounds!.source!.find((handle) => handle.id === side)!
  return {
    x: node.internals.positionAbsolute.x + handle.x + (side === Position.Right ? handle.width : side === Position.Left ? 0 : handle.width / 2),
    y: node.internals.positionAbsolute.y + handle.y + (side === Position.Bottom ? handle.height : side === Position.Top ? 0 : handle.height / 2),
  }
}

export function ConnectionPreview({ fromNode, fromHandle, toNode, toX, toY, connectionLineStyle }: ConnectionLineComponentProps) {
  const pointer = { x: toX, y: toY }
  const source = bounds(fromNode)
  const target = toNode ? bounds(toNode) : { position: pointer, width: 0, height: 0 }
  const fromPosition = facingSide(source, target)
  const toPosition = facingSide(target, source)
  const from = { ...anchor(fromNode, fromPosition), position: fromPosition }
  const to = { ...(toNode ? anchor(toNode, toPosition) : pointer), position: toPosition }
  const [start, end] = fromHandle.type === 'target' ? [to, from] : [from, to]
  return <BezierEdge sourceX={start.x} sourceY={start.y} targetX={end.x} targetY={end.y} sourcePosition={start.position} targetPosition={end.position} style={connectionLineStyle} interactionWidth={0} />
}
