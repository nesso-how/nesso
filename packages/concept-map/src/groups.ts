import type { PresentedGraph } from './types.ts'
import { relationKey } from '@nesso-how/schema'

type Concept = PresentedGraph['concepts'][number]
type Bounds = { x: number; y: number; width: number; height: number }
export type RelationGroup = {
  key: string
  direction: 'in' | 'out'
  anchor: string
  predicate: string
  members: string[]
  relations: string[]
  bounds: Bounds
}
const maxGroupGap = 28

const overlaps = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

export function groupRelations({
  concepts,
  relations,
  sizes = {},
}: {
  concepts: readonly Concept[]
  relations: PresentedGraph['relations']
  sizes?: Readonly<Record<string, { width: number; height: number }>>
}): RelationGroup[] {
  const boxes = new Map(
    concepts.map(({ id, position }) => [
      id,
      { ...position, ...(sizes[id] ?? { width: 100, height: 44 }) },
    ]),
  )
  const candidates = new Map<string, Omit<RelationGroup, 'key' | 'bounds'>>()
  for (const relation of relations) {
    if (relation.bend) continue
    for (const direction of ['out', 'in'] as const) {
      const anchor = direction === 'out' ? relation.source : relation.target
      const member = direction === 'out' ? relation.target : relation.source
      if (!boxes.has(anchor) || !boxes.has(member) || anchor === member) continue
      const candidate = JSON.stringify([direction, anchor, relation.predicate])
      const entry = candidates.get(candidate) ?? {
        direction,
        anchor,
        predicate: relation.predicate,
        members: [],
        relations: [],
      }
      entry.members.push(member)
      entry.relations.push(relationKey(relation))
      candidates.set(candidate, entry)
    }
  }
  const valid: RelationGroup[] = []
  for (const [candidate, base] of candidates) {
    const pending = new Set(base.members.slice().sort())
    while (pending.size) {
      const first = pending.values().next().value!
      pending.delete(first)
      const members = [first]
      for (let i = 0; i < members.length; i++) {
        for (const member of pending) {
          const a = boxes.get(members[i])!
          const b = boxes.get(member)!
          const distance = Math.hypot(
            Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width)),
            Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height)),
          )
          if (distance > maxGroupGap) continue
          pending.delete(member)
          members.push(member)
        }
      }
      if (members.length < 2) continue
      members.sort()
      const bounds: Bounds = { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity }
      for (const id of members) {
        const box = boxes.get(id)!
        bounds.x = Math.min(bounds.x, box.x - 12)
        bounds.y = Math.min(bounds.y, box.y - 12)
        bounds.width = Math.max(bounds.width, box.x + box.width + 12)
        bounds.height = Math.max(bounds.height, box.y + box.height + 12)
      }
      bounds.width -= bounds.x
      bounds.height -= bounds.y
      if ([...boxes].some(([id, box]) => !members.includes(id) && overlaps(bounds, box))) continue
      valid.push({
        ...base,
        members,
        bounds,
        key: JSON.stringify([candidate, members]),
        relations: base.relations.filter((_, i) => members.includes(base.members[i])).sort(),
      })
    }
  }
  valid.sort(
    (a, b) => b.members.length - a.members.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
  const groups: RelationGroup[] = []
  for (const candidate of valid) {
    if (
      groups.some(
        (group) =>
          candidate.relations.some((id) => group.relations.includes(id)) ||
          overlaps(group.bounds, candidate.bounds),
      )
    )
      continue
    groups.push(candidate)
  }
  return groups
}
