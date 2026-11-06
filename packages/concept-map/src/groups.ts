import type { GraphSnapshot } from '@nesso-how/core'
import { relationKey } from '@nesso-how/schema'

type Concept = GraphSnapshot['concepts'][number]
type Bounds = { x: number; y: number; width: number; height: number }
export type RelationGroup = {
  key: string
  candidate: string
  direction: 'in' | 'out'
  anchor: string
  predicate: string
  members: string[]
  relations: string[]
  bounds: Bounds
}
export type KeptGroups = ReadonlyMap<string, readonly ReadonlySet<string>[]>
const groupThresholds = { form: 28, break: 48 }

export function keepGroups(groups: readonly RelationGroup[]): KeptGroups {
  const kept = new Map<string, ReadonlySet<string>[]>()
  for (const group of groups)
    kept.set(group.candidate, [...(kept.get(group.candidate) ?? []), new Set(group.members)])
  return kept
}

const overlaps = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

export function groupRelations({
  concepts,
  relations,
  sizes = {},
  obstacles = [],
  kept = new Map(),
}: {
  concepts: readonly Concept[]
  relations: GraphSnapshot['relations']
  sizes?: Readonly<Record<string, { width: number; height: number }>>
  obstacles?: readonly Concept[]
  kept?: KeptGroups
}): RelationGroup[] {
  const boxes = new Map(
    [...concepts, ...obstacles].map(({ id, position }) => [
      id,
      { ...position, ...(sizes[id] ?? { width: 100, height: 44 }) },
    ]),
  )
  const candidates = new Map<string, Omit<RelationGroup, 'key' | 'bounds'>>()
  for (const relation of relations) {
    for (const direction of ['out', 'in'] as const) {
      const anchor = direction === 'out' ? relation.source : relation.target
      const member = direction === 'out' ? relation.target : relation.source
      if (!boxes.has(anchor) || !boxes.has(member) || anchor === member) continue
      const candidate = JSON.stringify([direction, anchor, relation.predicate])
      const entry = candidates.get(candidate) ?? {
        candidate,
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
  const valid: (RelationGroup & { kept: boolean })[] = []
  for (const base of candidates.values()) {
    const previous = kept.get(base.candidate) ?? []
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
          const together = previous.some(
            (cluster) => cluster.has(members[i]) && cluster.has(member),
          )
          if (distance > (together ? groupThresholds.break : groupThresholds.form)) continue
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
        key: JSON.stringify([base.candidate, members]),
        relations: base.relations.filter((_, i) => members.includes(base.members[i])).sort(),
        kept: previous.some((cluster) => members.filter((id) => cluster.has(id)).length >= 2),
      })
    }
  }
  valid.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      Number(b.kept) - Number(a.kept) ||
      a.key.localeCompare(b.key),
  )
  const groups: RelationGroup[] = []
  for (const candidate of valid) {
    if (
      groups.some(
        (group) =>
          candidate.members.includes(group.anchor) ||
          group.members.includes(candidate.anchor) ||
          overlaps(group.bounds, candidate.bounds),
      )
    )
      continue
    groups.push(candidate)
  }
  return groups
}
