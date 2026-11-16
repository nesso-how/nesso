import { Position } from '@xyflow/react'

type Point = { x: number; y: number }
type Endpoints = {
  source: Point
  target: Point
  sourcePosition: Position
  targetPosition: Position
}

const offset = (distance: number) => (distance >= 0 ? distance / 2 : 6.25 * Math.sqrt(-distance))

const control = (point: Point, other: Point, position: Position): Point => {
  switch (position) {
    case Position.Left:
      return { x: point.x - offset(point.x - other.x), y: point.y }
    case Position.Right:
      return { x: point.x + offset(other.x - point.x), y: point.y }
    case Position.Top:
      return { x: point.x, y: point.y - offset(point.y - other.y) }
    case Position.Bottom:
      return { x: point.x, y: point.y + offset(other.y - point.y) }
  }
}

export function relationCurve(
  { source, target, sourcePosition, targetPosition }: Endpoints,
  bend = 0,
) {
  const normal = { x: source.y - target.y, y: target.x - source.x }
  const start = control(source, target, sourcePosition)
  const end = control(target, source, targetPosition)
  const first = { x: start.x + (normal.x * bend * 4) / 3, y: start.y + (normal.y * bend * 4) / 3 }
  const second = { x: end.x + (normal.x * bend * 4) / 3, y: end.y + (normal.y * bend * 4) / 3 }
  return {
    path: `M${source.x},${source.y} C${first.x},${first.y} ${second.x},${second.y} ${target.x},${target.y}`,
    midpoint: {
      x: (source.x + target.x) / 8 + ((first.x + second.x) * 3) / 8,
      y: (source.y + target.y) / 8 + ((first.y + second.y) * 3) / 8,
    },
  }
}

export function draggedBend(source: Point, target: Point, delta: Point, initial: number) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const squared = dx * dx + dy * dy
  return squared < 1 ? initial : initial + (-dy * delta.x + dx * delta.y) / squared
}
