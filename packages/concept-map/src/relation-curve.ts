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

const geometry = ({ source, target, sourcePosition, targetPosition }: Endpoints) => {
  const first = control(source, target, sourcePosition)
  const second = control(target, source, targetPosition)
  return {
    first,
    second,
    midpoint: {
      x: (source.x + target.x) / 8 + ((first.x + second.x) * 3) / 8,
      y: (source.y + target.y) / 8 + ((first.y + second.y) * 3) / 8,
    },
  }
}

export function relationCurve(endpoints: Endpoints, bend = 0, reference = endpoints) {
  const { source, target } = endpoints
  const { first, second, midpoint } = geometry(endpoints)
  const anchor = reference === endpoints ? midpoint : geometry(reference).midpoint
  const normal = {
    x: reference.source.y - reference.target.y,
    y: reference.target.x - reference.source.x,
  }
  const displacement = {
    x: ((anchor.x - midpoint.x + normal.x * bend) * 4) / 3,
    y: ((anchor.y - midpoint.y + normal.y * bend) * 4) / 3,
  }
  return {
    path: `M${source.x},${source.y} C${first.x + displacement.x},${first.y + displacement.y} ${second.x + displacement.x},${second.y + displacement.y} ${target.x},${target.y}`,
    midpoint: {
      x: anchor.x + normal.x * bend,
      y: anchor.y + normal.y * bend,
    },
  }
}

export function draggedBend(source: Point, target: Point, delta: Point, initial: number) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const squared = dx * dx + dy * dy
  return squared < 1 ? initial : initial + (-dy * delta.x + dx * delta.y) / squared
}
