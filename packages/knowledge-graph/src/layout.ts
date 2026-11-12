import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { relationKey, type Position } from '@nesso-how/schema'

export type KnowledgeGraphLayout = Map<string, Position>
export type Bubble = SimulationNodeDatum & { id: string; label: string; radius: number }
export type Line = SimulationLinkDatum<Bubble> & {
  readonly id: string
  readonly predicate: string
  readonly source: Bubble
  readonly target: Bubble
}
export type KnowledgeGraphInput = {
  readonly concepts: readonly { readonly id: string; readonly label: string }[]
  readonly relations: readonly {
    readonly source: string
    readonly predicate: string
    readonly target: string
  }[]
}

const spacing = 96
const viewScale = 2.5
const ticks = 300

const hash = (value: string, seed: number) => {
  let result = seed
  for (let index = 0; index < value.length; index++)
    result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  return (result >>> 0) / 2 ** 32 - 0.5
}

const random = () => {
  let seed = 1
  return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
}

export function scene(
  graph: KnowledgeGraphInput,
  layout: KnowledgeGraphLayout,
  previous: ReadonlyMap<string, Bubble> = new Map(),
) {
  const ids = new Set(graph.concepts.map(({ id }) => id))
  const relations = graph.relations.filter(
    ({ source, target }) => source !== target && ids.has(source) && ids.has(target),
  )
  const degree = new Map<string, number>()
  for (const { source, target } of relations)
    for (const id of [source, target]) degree.set(id, (degree.get(id) ?? 0) + 1)
  const spread = spacing * Math.sqrt(graph.concepts.length)
  let cached = 0
  const bubbles = graph.concepts.map(({ id, label }): Bubble => {
    const radius = 8 + 3 * Math.sqrt(degree.get(id) ?? 0)
    const known = previous.get(id)
    if (known) return Object.assign(known, { label, radius })
    const position = layout.get(id)
    if (position) cached++
    return {
      id,
      label,
      radius,
      ...(position ?? { x: hash(id, 2166136261) * spread, y: hash(id, 374761393) * spread }),
    }
  })
  const byId = new Map(bubbles.map((bubble) => [bubble.id, bubble]))
  const lines = relations.map((relation): Line => ({
    id: relationKey(relation),
    predicate: relation.predicate,
    source: byId.get(relation.source)!,
    target: byId.get(relation.target)!,
  }))
  return { bubbles, lines, settled: previous.size > 0 || cached === bubbles.length, cached }
}

export const simulation = (bubbles: Bubble[], lines: Line[]) =>
  forceSimulation(bubbles)
    .stop()
    .randomSource(random())
    .force(
      'link',
      forceLink<Bubble, Line>(lines).distance(
        ({ source, target }) => source.radius + target.radius + spacing,
      ),
    )
    .force('charge', forceManyBody<Bubble>().strength(-240))
    .force(
      'collide',
      forceCollide<Bubble>((bubble) => bubble.radius + 28),
    )
    .force('x', forceX<Bubble>(0).strength(0.05))
    .force('y', forceY<Bubble>(0).strength(0.05))

export function settle(graph: KnowledgeGraphInput, layout: KnowledgeGraphLayout) {
  const result = scene(graph, layout)
  if (!result.settled)
    simulation(result.bubbles, result.lines)
      .alpha(result.cached ? 0.3 : 1)
      .tick(ticks)
  remember(result.bubbles, layout)
  return result
}

export const remember = (bubbles: readonly Bubble[], layout: KnowledgeGraphLayout) => {
  for (const { id, x, y } of bubbles) layout.set(id, { x: x!, y: y! })
}

export const viewPositions = (layout: KnowledgeGraphLayout, ids: readonly string[]) =>
  ids.flatMap((id) => {
    const position = layout.get(id)
    return position
      ? [
          {
            id,
            position: {
              x: Math.round(position.x * viewScale),
              y: Math.round(position.y * viewScale),
            },
          },
        ]
      : []
  })
