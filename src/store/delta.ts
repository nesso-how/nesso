import type { GraphSnapshot, SavedView } from '@nesso/plugin'

type Entry<T> = { readonly index: number; readonly value: T }
export type Change<T> = { readonly id: string; readonly before?: Entry<T>; readonly after?: Entry<T> }

export class ListEdit<T> {
  private current: readonly T[]
  private indices?: Map<string, number>
  private originalIndices?: Map<string, number>
  private readonly touched = new Map<string, Entry<T> | undefined>()
  private readonly original: readonly T[]
  private readonly key: (item: T) => string
  private readonly equal: (a: T, b: T) => boolean

  constructor(
    original: readonly T[],
    key: (item: T) => string,
    equal: (a: T, b: T) => boolean,
  ) {
    this.original = original
    this.key = key
    this.equal = equal
    this.current = original
  }

  get items(): readonly T[] { return this.current }

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
    for (const [id, before] of this.touched) {
      const index = this.index(id)
      const after = index === undefined ? undefined : { index, value: this.current[index] }
      if (!before && !after) continue
      if (before && after && before.index === after.index && this.equal(before.value, after.value)) {
        this.writable()[index!] = before.value
        continue
      }
      changes.push({ id, before, after })
    }
    return { items: changes.length === 0 && this.current.length === this.original.length ? this.original : this.current, changes }
  }
}

export const applyChanges = <T>(items: readonly T[], changes: readonly Change<T>[], key: (item: T) => string, forward: boolean): readonly T[] => {
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
  const entries = changes.flatMap((change) => {
    const entry = forward ? change.after : change.before
    return entry ? [entry] : []
  }).sort((a, b) => a.index - b.index)
  const remaining = items.filter((item) => !ids.has(key(item)))
  const next: T[] = []
  let cursor = 0
  let inserted = 0
  for (let index = 0; index < remaining.length + entries.length; index++) {
    next.push(entries[inserted]?.index === index ? entries[inserted++].value : remaining[cursor++])
  }
  return next
}

export const mergeChanges = <T>(left: readonly Change<T>[], right: readonly Change<T>[], equal: (a: T, b: T) => boolean): Change<T>[] => {
  const merged = new Map(left.map((change) => [change.id, change]))
  for (const change of right) {
    const previous = merged.get(change.id)
    merged.set(change.id, previous ? { ...change, before: previous.before } : change)
  }
  return [...merged.values()].filter(({ before, after }) =>
    before && after ? before.index !== after.index || !equal(before.value, after.value) : !!before || !!after)
}

export const sameConcept = (a: GraphSnapshot['concepts'][number], b: GraphSnapshot['concepts'][number]): boolean =>
  a.id === b.id && a.label === b.label && a.position.x === b.position.x && a.position.y === b.position.y
export const sameType = (a: GraphSnapshot['relationTypes'][number], b: GraphSnapshot['relationTypes'][number]): boolean => a.id === b.id && a.label === b.label
export const sameIds = (a: readonly string[], b: readonly string[]): boolean => a === b || (a.length === b.length && a.every((id, index) => id === b[index]))
export const sameView = (a: SavedView, b: SavedView): boolean => a.id === b.id && a.name === b.name && a.pinned === b.pinned && sameIds(a.conceptIds, b.conceptIds)

type ViewMetadata = Omit<SavedView, 'conceptIds'>
export type ViewChange = Change<ViewMetadata> & { readonly members: readonly Change<string>[] }
export type DocumentDelta = {
  readonly concepts: readonly Change<GraphSnapshot['concepts'][number]>[]
  readonly relations: readonly Change<GraphSnapshot['relations'][number]>[]
  readonly relationTypes: readonly Change<GraphSnapshot['relationTypes'][number]>[]
  readonly views: readonly ViewChange[]
}

export const viewChanges = (changes: readonly Change<SavedView>[]): ViewChange[] => changes.map(({ id, before, after }) => {
  const oldIds = before?.value.conceptIds ?? []
  const newIds = after?.value.conceptIds ?? []
  const oldIndices = new Map(oldIds.map((id, index) => [id, index]))
  const newIndices = new Map(newIds.map((id, index) => [id, index]))
  const reordered = !sameIds(oldIds.filter((id) => newIndices.has(id)), newIds.filter((id) => oldIndices.has(id)))
  const members = [...new Set([...oldIds, ...newIds])].flatMap((id): Change<string>[] => {
    const oldIndex = oldIndices.get(id)
    const newIndex = newIndices.get(id)
    if (oldIndex === newIndex || (!reordered && oldIndex !== undefined && newIndex !== undefined)) return []
    return [{ id, before: oldIndex === undefined ? undefined : { index: oldIndex, value: id }, after: newIndex === undefined ? undefined : { index: newIndex, value: id } }]
  })
  const metadata = (entry: Entry<SavedView> | undefined): Entry<ViewMetadata> | undefined => entry && {
    index: entry.index, value: { id: entry.value.id, name: entry.value.name, pinned: entry.value.pinned },
  }
  return { id, before: metadata(before), after: metadata(after), members }
})

export const hasDelta = (delta: DocumentDelta): boolean =>
  delta.concepts.length + delta.relations.length + delta.relationTypes.length + delta.views.length > 0
