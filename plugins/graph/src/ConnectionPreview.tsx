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

export function ConnectionPreview({ fromNode, toNode, toX, toY, connectionLineStyle }: ConnectionLineComponentProps) {
  const pointer = { x: toX, y: toY }
  const source = bounds(fromNode)
  const target = toNode ? bounds(toNode) : { position: pointer, width: 0, height: 0 }
  const sourcePosition = facingSide(source, target)
  const targetPosition = facingSide(target, source)
  const from = anchor(fromNode, sourcePosition)
  const to = toNode ? anchor(toNode, targetPosition) : pointer
  return <BezierEdge sourceX={from.x} sourceY={from.y} targetX={to.x} targetY={to.y} sourcePosition={sourcePosition} targetPosition={targetPosition} style={connectionLineStyle} interactionWidth={0} />
}
