import type { GraphSnapshot, WorkspaceMap, WorkspaceMapGroup } from '@nesso-how/core'
import { relationKey, type RelationBend } from '@nesso-how/schema'

type Entry<T> = { readonly index: number; readonly value: T }
export type Change<T> = {
  readonly id: string
  readonly before?: Entry<T>
  readonly after?: Entry<T>
}

export class ListEdit<T> {
  private current: readonly T[]
  private indices?: Map<string, number>
  private originalIndices?: Map<string, number>
  private readonly touched = new Map<string, Entry<T> | undefined>()
  private readonly moved = new Set<string>()
  private readonly original: readonly T[]
  private readonly key: (item: T) => string
  private readonly equal: (a: T, b: T) => boolean

  constructor(original: readonly T[], key: (item: T) => string, equal: (a: T, b: T) => boolean) {
    this.original = original
    this.key = key
    this.equal = equal
    this.current = original
  }

  get items(): readonly T[] {
    return this.current
  }

  private index(id: string): number | undefined {
    this.indices ??= new Map(this.current.map((item, index) => [this.key(item), index]))
    if (this.current === this.original) this.originalIndices ??= this.indices
    return this.indices.get(id)
  }

  get(id: string): T | undefined {
    const index = this.index(id)
    return index === undefined ? undefined : this.current[index]
  }

  private touch(id: string): void {
    if (this.touched.has(id)) return
    this.originalIndices ??= new Map(this.original.map((item, index) => [this.key(item), index]))
    const index = this.originalIndices.get(id)
    this.touched.set(id, index === undefined ? undefined : { index, value: this.original[index] })
  }

  private writable(): T[] {
    if (this.current === this.original) this.current = [...this.original]
    return this.current as T[]
  }

  add(item: T): void {
    const id = this.key(item)
    this.index(id)
    this.touch(id)
    if (this.indices === this.originalIndices) this.indices = new Map(this.indices)
    this.indices!.set(id, this.current.length)
    this.writable().push(item)
  }

  set(id: string, item: T): void {
    const index = this.index(id)
    if (index === undefined || this.current[index] === item) return
    this.touch(id)
    const nextId = this.key(item)
    if (nextId !== id) {
      this.touch(nextId)
      if (this.indices === this.originalIndices) this.indices = new Map(this.indices)
      this.indices!.delete(id)
      this.indices!.set(nextId, index)
    }
    this.writable()[index] = item
  }

  move(id: string, beforeId: string | null): void {
    const from = this.index(id)
    if (from === undefined) return
    this.touch(id)
    this.moved.add(id)
    const items = this.writable()
    const [item] = items.splice(from, 1)
    const to =
      beforeId === null ? items.length : items.findIndex((other) => this.key(other) === beforeId)
    items.splice(to, 0, item)
    this.indices = undefined
  }

  removeWhere(remove: (item: T) => boolean): void {
    const next = this.current.filter((item) => {
      if (!remove(item)) return true
      this.touch(this.key(item))
      return false
    })
    if (next.length === this.current.length) return
    this.current = next
    this.indices = undefined
  }

  finish(): { items: readonly T[]; changes: Change<T>[] } {
    const changes: Change<T>[] = []
    const reordered =
      this.moved.size > 0 &&
      (this.current.length !== this.original.length ||
        this.current.some((item, index) => this.key(item) !== this.key(this.original[index])))
    for (const [id, before] of this.touched) {
      const index = this.index(id)
      const after = index === undefined ? undefined : { index, value: this.current[index] }
      if (!before && !after) continue
      if (
        before &&
        after &&
        before.index === after.index &&
        this.equal(before.value, after.value) &&
        !(reordered && this.moved.has(id))
      ) {
        this.writable()[index!] = before.value
        continue
      }
      changes.push({ id, before, after })
    }
    return {
      items:
        changes.length === 0 && this.current.length === this.original.length
          ? this.original
          : this.current,
      changes,
    }
  }
}

export const applyChanges = <T>(
  items: readonly T[],
  changes: readonly Change<T>[],
  key: (item: T) => string,
  forward: boolean,
): readonly T[] => {
  if (changes.length === 0) return items
  if (changes.every(({ before, after }) => before && after && before.index === after.index)) {
    const next = [...items]
    for (const change of changes) {
      const entry = (forward ? change.after : change.before)!
      next[entry.index] = entry.value
    }
    return next
  }
  const ids = new Set(changes.map((change) => change.id))
  const entries = changes
    .flatMap((change) => {
      const entry = forward ? change.after : change.before
      return entry ? [entry] : []
    })
    .sort((a, b) => a.index - b.index)
  const remaining = items.filter((item) => !ids.has(key(item)))
  const next: T[] = []
  let cursor = 0
  let inserted = 0
  for (let index = 0; index < remaining.length + entries.length; index++) {
    next.push(entries[inserted]?.index === index ? entries[inserted++].value : remaining[cursor++])
  }
  return next
}

export const mergeChanges = <T>(
  left: readonly Change<T>[],
  right: readonly Change<T>[],
  equal: (a: T, b: T) => boolean,
): Change<T>[] => {
  if (left.length === 0 || right.length === 0) return [...left, ...right]
  const reindex = (changes: readonly Change<T>[], forward: boolean) => {
    const structural = changes.filter(
      ({ before, after }) => !before || !after || before.index !== after.index,
    )
    const source = structural.flatMap((change) => {
      const value = forward ? change.before : change.after
      return value ? [value.index] : []
    })
    const target = structural
      .flatMap((change) => {
        const value = forward ? change.after : change.before
        return value ? [value.index] : []
      })
      .sort((a, b) => a - b)
    return (entry: Entry<T> | undefined): Entry<T> | undefined => {
      if (!entry || structural.length === 0) return entry
      let index = entry.index - source.filter((index) => index < entry.index).length
      for (const inserted of target) {
        if (inserted > index) break
        index++
      }
      return index === entry.index ? entry : { ...entry, index }
    }
  }
  const after = reindex(right, true)
  const before = reindex(left, false)
  const rightIds = new Set(right.map(({ id }) => id))
  const merged = new Map(
    left.map((change) => [
      change.id,
      rightIds.has(change.id) ? change : { ...change, after: after(change.after) },
    ]),
  )
  for (const change of right) {
    const previous = merged.get(change.id)
    merged.set(change.id, {
      ...change,
      before: previous ? previous.before : before(change.before),
    })
  }
  return [...merged.values()].filter(({ before, after }) =>
    before && after
      ? before.index !== after.index || !equal(before.value, after.value)
      : !!before || !!after,
  )
}

type Member = WorkspaceMap['members'][number]

export const sameConcept = (
  a: GraphSnapshot['concepts'][number],
  b: GraphSnapshot['concepts'][number],
): boolean => a.id === b.id && a.label === b.label && a.notes === b.notes
export const sameMember = (a: Member, b: Member): boolean =>
  a.id === b.id &&
  a.color === b.color &&
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.strikethrough === b.strikethrough &&
  a.position.x === b.position.x &&
  a.position.y === b.position.y
export const sameType = (
  a: GraphSnapshot['relationTypes'][number],
  b: GraphSnapshot['relationTypes'][number],
): boolean => a.id === b.id && a.label === b.label
export const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a === b || (a.length === b.length && a.every((id, index) => id === b[index]))
export const sameMembers = (a: readonly Member[], b: readonly Member[]): boolean =>
  a === b || (a.length === b.length && a.every((member, index) => sameMember(member, b[index])))
export const sameBend = (a: RelationBend, b: RelationBend): boolean =>
  relationKey(a) === relationKey(b) && a.bend === b.bend
export const sameBends = (
  a: readonly RelationBend[] = [],
  b: readonly RelationBend[] = [],
): boolean =>
  a === b || (a.length === b.length && a.every((bend, index) => sameBend(bend, b[index])))
type MapMetadata = Omit<WorkspaceMap, 'members' | 'relationBends'>
export const sameMapGroup = (a: WorkspaceMapGroup, b: WorkspaceMapGroup): boolean =>
  a.id === b.id && a.name === b.name
export const sameMapMetadata = (a: MapMetadata, b: MapMetadata): boolean =>
  sameMapGroup(a, b) && a.groupId === b.groupId
export const sameMap = (a: WorkspaceMap, b: WorkspaceMap): boolean =>
  sameMapMetadata(a, b) &&
  sameMembers(a.members, b.members) &&
  sameBends(a.relationBends, b.relationBends)

export type MapChange = Change<MapMetadata> & {
  readonly members: readonly Change<Member>[]
  readonly relationBends: readonly Change<RelationBend>[]
}
export type DocumentDelta = {
  readonly concepts: readonly Change<GraphSnapshot['concepts'][number]>[]
  readonly relations: readonly Change<GraphSnapshot['relations'][number]>[]
  readonly relationTypes: readonly Change<GraphSnapshot['relationTypes'][number]>[]
  readonly maps: readonly MapChange[]
  readonly pinnedMapIds: readonly Change<string>[]
  readonly mapGroups: readonly Change<WorkspaceMapGroup>[]
}

const listChanges = <T>(
  oldItems: readonly T[],
  newItems: readonly T[],
  key: (item: T) => string,
  equal: (a: T, b: T) => boolean,
): Change<T>[] => {
  const oldIndices = new Map(oldItems.map((item, index) => [key(item), index]))
  const newIndices = new Map(newItems.map((item, index) => [key(item), index]))
  const reordered = !sameIds(
    oldItems.flatMap((item) => (newIndices.has(key(item)) ? [key(item)] : [])),
    newItems.flatMap((item) => (oldIndices.has(key(item)) ? [key(item)] : [])),
  )
  const ids = [...new Set([...oldIndices.keys(), ...newIndices.keys()])]
  return ids.flatMap((id): Change<T>[] => {
    const oldIndex = oldIndices.get(id)
    const newIndex = newIndices.get(id)
    const old = oldIndex === undefined ? undefined : oldItems[oldIndex]
    const next = newIndex === undefined ? undefined : newItems[newIndex]
    if (old && next && (oldIndex === newIndex || !reordered) && (old === next || equal(old, next)))
      return []
    return [
      {
        id,
        before: old && { index: oldIndex!, value: old },
        after: next && { index: newIndex!, value: next },
      },
    ]
  })
}

export const mapChanges = (changes: readonly Change<WorkspaceMap>[]): MapChange[] =>
  changes.map(({ id, before, after }) => {
    const metadata = (entry: Entry<WorkspaceMap> | undefined): Entry<MapMetadata> | undefined => {
      if (!entry) return undefined
      const { members: _members, relationBends: _bends, ...value } = entry.value
      return { index: entry.index, value }
    }
    return {
      id,
      before: metadata(before),
      after: metadata(after),
      members: listChanges(
        before?.value.members ?? [],
        after?.value.members ?? [],
        (member) => member.id,
        sameMember,
      ),
      relationBends: listChanges(
        before?.value.relationBends ?? [],
        after?.value.relationBends ?? [],
        relationKey,
        sameBend,
      ),
    }
  })

export const hasDelta = (delta: DocumentDelta): boolean =>
  delta.concepts.length +
    delta.relations.length +
    delta.relationTypes.length +
    delta.maps.length +
    delta.pinnedMapIds.length +
    delta.mapGroups.length >
  0
