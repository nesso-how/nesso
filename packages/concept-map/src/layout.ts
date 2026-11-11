import {
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { Position } from '@nesso-how/schema'

export type LayoutBox = {
  readonly id: string
  readonly width: number
  readonly height: number
  readonly position?: Position
}
export type LayoutBounds = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
type Size = { readonly width: number; readonly height: number }
type LayoutNode = SimulationNodeDatum & { id: string; width: number; height: number }
type Link = { readonly source: string; readonly target: string }

const gap = 140
const reach = 360
const padding = 24
const ticks = 150

const center = (box: LayoutBox & { position: Position }) => ({
  x: box.position.x + box.width / 2,
  y: box.position.y + box.height / 2,
})

const extent = ({ width, height }: Size, angle: number) =>
  Math.min(width / 2 / Math.abs(Math.cos(angle)), height / 2 / Math.abs(Math.sin(angle)))

const distance = (a: Size, b: Size, angle: number) => extent(a, angle) + extent(b, angle) + gap

const random = () => {
  let seed = 1
  return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
}

const edges = (bounds: LayoutBounds, origin: Position, anchor: Size, box: Size) => {
  const x = anchor.width / 2 + gap + box.width
  const y = anchor.height / 2 + gap + box.height
  return [
    { x: origin.x - 1, y: origin.y, room: origin.x - bounds.x - x },
    { x: origin.x + 1, y: origin.y, room: bounds.x + bounds.width - origin.x - x },
    { x: origin.x, y: origin.y - 1, room: origin.y - bounds.y - y },
    { x: origin.x, y: origin.y + 1, room: bounds.y + bounds.height - origin.y - y },
  ].filter(({ room }) => room < 0)
}

const freeDirection = (origin: Position, obstacles: readonly Position[]) => {
  const angles = obstacles
    .map(({ x, y }) => Math.atan2(y - origin.y, x - origin.x))
    .sort((a, b) => a - b)
  if (angles.length === 0) return { angle: 0, width: 2 * Math.PI }
  return angles.reduce(
    (best, angle, index) => {
      const next = index + 1 < angles.length ? angles[index + 1] : angles[0] + 2 * Math.PI
      return next - angle > best.width ? { angle: (angle + next) / 2, width: next - angle } : best
    },
    { angle: 0, width: 0 },
  )
}

const collide = () => {
  let fixed: LayoutNode[] = []
  let free: LayoutNode[] = []
  const force = () => {
    free.forEach((a, index) => {
      for (const b of [...free.slice(index + 1), ...fixed]) {
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const ox = (a.width + b.width) / 2 + padding - Math.abs(dx)
        const oy = (a.height + b.height) / 2 + padding - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        const share = b.fx == null ? 0.5 : 1
        if (ox < oy) {
          const shift = (dx < 0 ? -ox : ox) * share
          a.x! -= shift
          if (b.fx == null) b.x! += shift
        } else {
          const shift = (dy < 0 ? -oy : oy) * share
          a.y! -= shift
          if (b.fx == null) b.y! += shift
        }
      }
    })
  }
  force.initialize = (all: LayoutNode[]) => {
    fixed = all.filter((node) => node.fx != null)
    free = all.filter((node) => node.fx == null)
  }
  return force
}

export function arrange({
  fixed,
  free,
  links,
  bounds,
}: {
  readonly fixed: readonly (LayoutBox & { position: Position })[]
  readonly free: readonly LayoutBox[]
  readonly links: readonly Link[]
  readonly bounds?: LayoutBounds
}): Map<string, Position> {
  const boxes = new Map(fixed.map((box) => [box.id, box]))
  const seeds = new Map<string, LayoutBox[]>()
  for (const box of free) {
    if (box.position) continue
    const link = links.find(
      ({ source, target }) =>
        (source === box.id && boxes.has(target)) || (target === box.id && boxes.has(source)),
    )
    const anchor = link ? (link.source === box.id ? link.target : link.source) : ''
    seeds.set(anchor, [...(seeds.get(anchor) ?? []), box])
  }
  const seeded = new Map<string, Position>()
  for (const [anchor, group] of seeds) {
    const box = boxes.get(anchor)
    const origin = box ? center(box) : { x: 0, y: 0 }
    const size = box ?? { width: 0, height: 0 }
    const connected = new Set(
      links.flatMap(({ source, target }) =>
        source === anchor ? [target] : target === anchor ? [source] : [],
      ),
    )
    const obstacles = fixed
      .filter(({ id }) => id !== anchor)
      .map((other) => ({ id: other.id, ...center(other) }))
      .filter(({ id, x, y }) => connected.has(id) || Math.hypot(x - origin.x, y - origin.y) < reach)
    const largest = {
      width: Math.max(...group.map(({ width }) => width)),
      height: Math.max(...group.map(({ height }) => height)),
    }
    const opening = freeDirection(origin, [
      ...obstacles,
      ...(bounds ? edges(bounds, origin, size, largest) : []),
    ])
    const step = Math.min(opening.width / group.length, Math.PI / 5)
    group.forEach((item, index) => {
      const angle = opening.angle + (index - (group.length - 1) / 2) * step
      const radius = distance(size, item, angle)
      seeded.set(item.id, {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      })
    })
  }
  const nodes: LayoutNode[] = [
    ...fixed.map((box) => {
      const { x, y } = center(box)
      return { id: box.id, width: box.width, height: box.height, x, y, fx: x, fy: y }
    }),
    ...free.map((box) => {
      const { x, y } = box.position
        ? center({ ...box, position: box.position })
        : seeded.get(box.id)!
      return { id: box.id, width: box.width, height: box.height, x, y }
    }),
  ]
  const ids = new Set(nodes.map(({ id }) => id))
  forceSimulation(nodes)
    .stop()
    .randomSource(random())
    .alphaDecay(1 - Math.pow(0.001, 1 / ticks))
    .force(
      'link',
      forceLink<LayoutNode, SimulationLinkDatum<LayoutNode>>(
        links
          .filter(({ source, target }) => ids.has(source) && ids.has(target) && source !== target)
          .map(({ source, target }) => ({ source, target })),
      )
        .id(({ id }) => id)
        .distance(({ source, target }) => {
          const a = source as LayoutNode
          const b = target as LayoutNode
          return distance(a, b, Math.atan2(b.y! - a.y!, b.x! - a.x!))
        }),
    )
    .force(
      'charge',
      forceManyBody<LayoutNode>()
        .strength((node) => (node.fx == null ? -300 : 0))
        .distanceMax(reach),
    )
    .force('collide', collide())
    .tick(ticks)
  return new Map(
    nodes
      .filter((node) => node.fx == null)
      .map((node) => [
        node.id,
        { x: Math.round(node.x! - node.width / 2), y: Math.round(node.y! - node.height / 2) },
      ]),
  )
}
