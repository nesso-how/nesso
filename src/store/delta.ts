import type { GraphSnapshot, WorkspaceMap, WorkspaceMapGroup } from '@nesso-how/core'
import { NessoError } from '@nesso-how/errors'
import { relationKey, type RelationBend } from '@nesso-how/schema'

type Entry<T> = { readonly index: number; readonly value: T }
export type Change<T> = {
  readonly id: string
  readonly before?: Entry<T>
  readonly after?: Entry<T>
}

type Positions = ReadonlyMap<string, number | undefined>
type Lookup = { get(key: string): number | undefined }

const overlayLimit = 256

const count = (sorted: readonly number[], below: (value: number, index: number) => boolean) => {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (below(sorted[middle], middle)) low = middle + 1
    else high = middle
  }
  return low
}

const remainingRank = (at: number, removed: readonly number[]) =>
  at - count(removed, (index) => index < at)

const shiftedPosition = (at: number, removed: readonly number[], inserted: readonly number[]) => {
  const rank = remainingRank(at, removed)
  return rank + count(inserted, (index, offset) => index - offset <= rank)
}

class Shift {
  private readonly sources: number[]
  private readonly targets: number[]

  constructor(base: Lookup, moved: Positions) {
    this.sources = []
    this.targets = []
    for (const [key, at] of moved) {
      const source = base.get(key)
      if (source !== undefined) this.sources.push(source)
      if (at !== undefined) this.targets.push(at)
    }
    this.sources.sort((a, b) => a - b)
    this.targets.sort((a, b) => a - b)
  }

  apply(at: number): number {
    return shiftedPosition(at, this.sources, this.targets)
  }
}

class KeyIndex {
  private shift?: Shift
  private readonly base: ReadonlyMap<string, number>
  private readonly moved: Positions
  readonly size: number

  constructor(base: ReadonlyMap<string, number>, moved: Positions = new Map(), size = base.size) {
    this.base = base
    this.moved = moved
    this.size = size
  }

  get(key: string): number | undefined {
    if (this.moved.has(key)) return this.moved.get(key)
    const at = this.base.get(key)
    if (at === undefined || this.moved.size === 0) return at
    return (this.shift ??= new Shift(this.base, this.moved)).apply(at)
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  derive(moved: Positions, size: number): KeyIndex | undefined {
    if (moved.size === 0) return this
    const shift = new Shift(this, moved)
    const next = new Map<string, number | undefined>()
    for (const [key, at] of this.moved)
      if (!moved.has(key)) next.set(key, at === undefined ? undefined : shift.apply(at))
    for (const [key, at] of moved) if (at !== undefined || this.base.has(key)) next.set(key, at)
    return next.size > overlayLimit ? undefined : new KeyIndex(this.base, next, size)
  }
}

const indexes = new WeakMap<readonly unknown[], KeyIndex>()

export const indexOf = <T>(items: readonly T[], key: (item: T) => string): KeyIndex => {
  let index = indexes.get(items)
  if (!index)
    indexes.set(items, (index = new KeyIndex(new Map(items.map((item, at) => [key(item), at])))))
  return index
}

const splice = <T>(
  items: readonly T[],
  removed: readonly number[],
  inserted: readonly Entry<T>[],
): T[] => {
  const start = Math.min(removed[0] ?? items.length, inserted[0]?.index ?? items.length)
  const next = items.slice(0, start)
  let read = start
  let skip = 0
  let insert = 0
  while (read < items.length || insert < inserted.length) {
    if (inserted[insert]?.index === next.length) next.push(inserted[insert++].value)
    else if (read >= items.length) break
    else if (removed[skip] === read) {
      skip++
      read++
    } else next.push(items[read++])
  }
  if (skip !== removed.length || insert !== inserted.length)
    throw new NessoError([{ path: 'history', message: 'Cannot apply changes at recorded indices' }])
  return next
}

export class ListEdit<T> {
  private current: readonly T[]
  private base?: KeyIndex
  private shift?: Shift
  private exact = true
  private readonly positions = new Map<string, number | undefined>()
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

  snapshot(): readonly T[] {
    return this.current === this.original ? this.original : [...this.current]
  }

  private index(id: string): number | undefined {
    if (!this.exact) {
      const at = this.current.findLastIndex((item) => this.key(item) === id)
      return at < 0 ? undefined : at
    }
    if (this.positions.has(id)) return this.positions.get(id)
    const at = this.originalIndex().get(id)
    if (at === undefined || this.positions.size === 0) return at
    return (this.shift ??= new Shift(this.originalIndex(), this.positions)).apply(at)
  }

  private originalIndex(): KeyIndex {
    return (this.base ??= indexOf(this.original, this.key))
  }

  get(id: string): T | undefined {
    const index = this.index(id)
    return index === undefined ? undefined : this.current[index]
  }

  private touch(id: string): void {
    if (this.touched.has(id)) return
    const index = this.originalIndex().get(id)
    this.touched.set(id, index === undefined ? undefined : { index, value: this.original[index] })
  }

  private reposition(update: (at: number) => number): void {
    for (const [id, at] of this.positions) if (at !== undefined) this.positions.set(id, update(at))
    this.shift = undefined
  }

  private writable(): T[] {
    if (this.current === this.original) this.current = [...this.original]
    return this.current as T[]
  }

  add(item: T): void {
    const id = this.key(item)
    this.touch(id)
    if (this.index(id) === undefined) {
      if (this.touched.get(id)) this.moved.add(id)
      this.positions.set(id, this.current.length)
    } else this.exact = false
    this.writable().push(item)
  }

  set(id: string, item: T): void {
    const index = this.index(id)
    if (index === undefined || this.current[index] === item) return
    this.touch(id)
    const nextId = this.key(item)
    if (nextId !== id) {
      if (this.index(nextId) !== undefined) this.exact = false
      this.touch(nextId)
      this.positions.set(id, undefined)
      this.positions.set(nextId, index)
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
      beforeId === null ? items.length : items.findIndex((item) => this.key(item) === beforeId)
    items.splice(to, 0, item)
    if (!this.exact) return
    this.reposition((at) => {
      const remaining = at > from ? at - 1 : at
      return remaining >= to ? remaining + 1 : remaining
    })
    this.positions.set(id, to)
  }

  remove(ids: Iterable<string>): void {
    if (!this.exact) {
      const removed = new Set(ids)
      this.current = this.current.filter((item) => {
        const id = this.key(item)
        if (!removed.has(id)) return true
        this.touch(id)
        return false
      })
      return
    }
    const found = new Map<string, number>()
    for (const id of ids) {
      const index = this.index(id)
      if (index !== undefined) found.set(id, index)
    }
    if (found.size === 0) return
    for (const id of found.keys()) {
      this.touch(id)
      this.positions.set(id, undefined)
    }
    const removed = [...found.values()]
    removed.sort((a, b) => a - b)
    this.current = splice(this.current, removed, [])
    this.reposition((at) => remainingRank(at, removed))
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
        this.equal(before.value, after.value)
      ) {
        this.writable()[index!] = before.value
        if (!(reordered && this.moved.has(id))) continue
        after.value = before.value
      }
      changes.push({ id, before, after })
    }
    const items =
      changes.length === 0 && this.current.length === this.original.length
        ? this.original
        : this.current
    if (items !== this.original && this.exact) {
      const index = this.originalIndex().derive(this.positions, items.length)
      if (index) indexes.set(items, index)
    }
    return { items, changes }
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
    const index = indexes.get(items)
    if (index) indexes.set(next, index)
    return next
  }
  const index = indexOf(items, key)
  const moved = new Map<string, number | undefined>()
  const removed: number[] = []
  const entries: Entry<T>[] = []
  for (const change of changes) {
    const at = index.get(change.id)
    if (at !== undefined) removed.push(at)
    const entry = forward ? change.after : change.before
    if (entry) entries.push(entry)
    moved.set(change.id, entry?.index)
  }
  removed.sort((a, b) => a - b)
  entries.sort((a, b) => a.index - b.index)
  const next = splice(items, removed, entries)
  const derived = index.derive(moved, index.size - removed.length + entries.length)
  if (derived) indexes.set(next, derived)
  return next
}

export const mergeChanges = <T>(
  left: readonly Change<T>[],
  right: readonly Change<T>[],
  equal: (a: T, b: T) => boolean,
): Change<T>[] => {
  if (left.length === 0 || right.length === 0) return [...left, ...right]
  const positions = (changes: readonly Change<T>[], side: 'before' | 'after') =>
    changes.flatMap((change) => (change[side] ? [change[side].index] : [])).sort((a, b) => a - b)

  const reindex = (changes: readonly Change<T>[], from: 'before' | 'after') => {
    if (changes.every(({ before, after }) => before && after && before.index === after.index))
      return (entry: Entry<T> | undefined) => entry
    const source = positions(changes, from)
    const target = positions(changes, from === 'before' ? 'after' : 'before')
    return (entry: Entry<T> | undefined): Entry<T> | undefined => {
      if (!entry) return entry
      const index = shiftedPosition(entry.index, source, target)
      return index === entry.index ? entry : { ...entry, index }
    }
  }
  const after = reindex(right, 'before')
  const before = reindex(left, 'after')
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
  const changes = [...merged.values()]
  let beforePositions: number[] | undefined
  let afterPositions: number[] | undefined
  return changes.filter(({ before, after }) => {
    if (!before || !after) return !!before || !!after
    if (before.index !== after.index || !equal(before.value, after.value)) return true
    beforePositions ??= positions(changes, 'before')
    afterPositions ??= positions(changes, 'after')
    return (
      remainingRank(before.index, beforePositions) !== remainingRank(after.index, afterPositions)
    )
  })
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
