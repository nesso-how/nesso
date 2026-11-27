import type { WorkspaceMap, WorkspaceState } from '@nesso-how/core'
import { NessoError } from '@nesso-how/errors'
import { colorPresets, relationKey, type Graph, type Relation } from '@nesso-how/schema'
import { createFileStorage } from '../../electron/persistence/file-storage.ts'
import { createNessoStore } from '../../src/store/create.ts'
import { connectPersistence } from '../../src/store/persistence.ts'

type GraphOptions = {
  readonly concepts: number
  readonly relations: number
  readonly maps: number
  readonly mapSize: number
  readonly mapGroups: number
  readonly notes: number
  readonly seed: number
}

export const defaultGraphOptions = (concepts: number): GraphOptions => ({
  concepts,
  relations: 1.5,
  maps: Math.max(1, Math.round(concepts / 100)),
  mapSize: 30,
  mapGroups: 5,
  notes: 200,
  seed: 1,
})

const syllables = ['ka', 'lo', 'mi', 'ren', 'su', 'ta', 'vel', 'no', 'dri', 'pa', 'zen', 'or']
const relationTypes = ['causes', 'part of', 'example of', 'depends on', 'contrasts', 'leads to']

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let value = Math.imul(seed ^ (seed >>> 15), seed | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32
}

export function generateGraph(options: GraphOptions): { graph: Graph; workspace: WorkspaceState } {
  const next = random(options.seed)
  const pick = (length: number) => Math.floor(next() * length)
  const word = () =>
    Array.from({ length: 2 + pick(2) }, () => syllables[pick(syllables.length)]).join('')
  const words = (length: number) => {
    let text = ''
    while (text.length < length) text += `${text ? ' ' : ''}${word()}`
    return text.slice(0, length)
  }
  const conceptId = (index: number) => `urn:nesso:perf:concept:${index}`
  const concepts = Array.from({ length: options.concepts }, (_, index) => {
    const notes = pick(2) ? words(options.notes) : ''
    return {
      id: conceptId(index),
      label: words(4 + pick(20)),
      ...(notes && { notes }),
    }
  })
  const types = relationTypes.map((label, index) => ({
    id: `urn:nesso:perf:type:${index}`,
    label,
  }))
  const relations: Relation[] = []
  const keys = new Set<string>()
  const window = options.mapSize * 2
  const total = Math.min(
    Math.round(options.concepts * options.relations),
    (options.concepts * (options.concepts - 1) * types.length) / 2,
  )
  while (relations.length < total) {
    const source = 1 + pick(options.concepts - 1)
    const target = next() < 0.8 ? Math.max(0, source - 1 - pick(window)) : pick(source)
    const relation = {
      source: conceptId(source),
      predicate: types[pick(types.length)].id,
      target: conceptId(target),
    }
    const key = relationKey(relation)
    if (keys.has(key)) continue
    keys.add(key)
    relations.push(relation)
  }
  const groups = Array.from({ length: Math.min(options.mapGroups, options.maps) }, (_, index) => ({
    id: `urn:nesso:perf:group:${index}`,
    name: `Group ${index + 1}`,
  }))
  const size = Math.min(options.mapSize, options.concepts)
  const step = options.maps > 1 ? (options.concepts - size) / (options.maps - 1) : 0
  const columns = Math.ceil(Math.sqrt(size))
  const maps = Array.from({ length: options.maps }, (_, index): WorkspaceMap => {
    const start = Math.round(index * step)
    const group = groups[index % (groups.length + 1)]
    return {
      id: `urn:nesso:perf:map:${index}`,
      name: `Map ${index + 1}`,
      ...(group && { groupId: group.id }),
      members: Array.from({ length: size }, (_, offset) => ({
        id: conceptId(start + offset),
        position: {
          x: (offset % columns) * 220 + pick(60),
          y: Math.floor(offset / columns) * 140 + pick(40),
        },
        ...(next() < 0.2 && { color: colorPresets[pick(colorPresets.length)] }),
      })),
    }
  })
  return {
    graph: { concepts, relationTypes: types, relations },
    workspace: {
      activeMapId: maps[0]?.id ?? null,
      pinnedMapIds: maps.slice(0, 3).map(({ id }) => id),
      mapGroups: groups,
      maps,
      viewports: {},
    },
  }
}

export async function writeDocument(directory: string, options: GraphOptions) {
  const { graph, workspace } = generateGraph(options)
  const host = createNessoStore(graph, { workspace })
  host.store.applyOperations([{ kind: 'preferences.intro-seen' }])
  const persistence = connectPersistence(host, createFileStorage(directory), {
    blocked: [],
    issues: [],
  })
  await persistence.dispose()
  const { persistenceIssues } = host.store.getState()
  if (persistenceIssues.length) throw new NessoError([...persistenceIssues])
}
