import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { relationKey, serializeGraph, type Graph } from '@nesso-how/schema'
import type { WorkspaceState } from '@nesso-how/core'
import { createGraphElements, indexGraph } from '../../packages/concept-map/src/adapters.ts'
import { groupRelations } from '../../packages/concept-map/src/groups.ts'
import { presentedGraph } from '../../packages/concept-map/src/types.ts'
import { scene, settle } from '../../packages/knowledge-graph/src/layout.ts'
import { createFileStorage } from '../../electron/persistence/file-storage.ts'
import { createNessoStore } from '../../src/store/create.ts'
import { initializeNessoStore } from '../../src/store/initialize.ts'
import { materialize } from '../../src/store/operations.ts'
import { connectPersistence, loadPersistence } from '../../src/store/persistence.ts'
import { defaultGraphOptions, generateGraph, writeDocument } from './generate.ts'

type Fixture = { graph: Graph; workspace: WorkspaceState; directory: string }
type Run = () => unknown
type Benchmark = {
  name: string
  setup: (fixture: Fixture) => Run | { prepare: Run; run: Run }
}

const open = ({ graph, workspace }: Fixture) => {
  const host = createNessoStore(graph, { workspace })
  const ids = host.store.getState().mapGraph.concepts.map(({ id }) => id)
  return { host, store: host.store, ids }
}

const benchmarks: Benchmark[] = [
  {
    name: 'store: edit label',
    setup: (fixture) => {
      const { store, ids } = open(fixture)
      let count = 0
      return () =>
        store.applyOperations(
          [{ kind: 'concept.label', id: ids[count % ids.length], value: `Label ${count++}` }],
          { historyGroup: 'perf' },
        )
    },
  },
  {
    name: 'store: move concept',
    setup: (fixture) => {
      const { store, ids } = open(fixture)
      let count = 0
      return () =>
        store.applyOperations([
          { kind: 'concept.position', id: ids[0], value: { x: count++ % 100, y: 0 } },
        ])
    },
  },
  {
    name: 'store: connect and remove relation',
    setup: (fixture) => {
      const { store, ids } = open(fixture)
      const type = fixture.graph.relationTypes[0]
      const relation = { source: ids[0], predicate: type.id, target: ids[ids.length - 1] }
      return () => {
        store.applyOperations([{ kind: 'relation.connect', ...relation, type }])
        store.applyOperations([{ kind: 'relation.remove', id: relationKey(relation) }])
      }
    },
  },
  {
    name: 'store: switch map',
    setup: (fixture) => {
      const { store } = open(fixture)
      const [first, second] = fixture.workspace.maps.map(({ id }) => id)
      let count = 0
      return () =>
        store.applyOperations([
          { kind: 'map.activate', id: count++ % 2 ? (first ?? null) : (second ?? null) },
        ])
    },
  },
  {
    name: 'store: undo and redo',
    setup: (fixture) => {
      const { store, ids } = open(fixture)
      store.applyOperations([{ kind: 'concept.label', id: ids[0], value: 'Edited' }])
      return () => {
        store.undo()
        store.redo()
      }
    },
  },
  {
    name: 'persistence: serialize graph',
    setup:
      ({ graph }) =>
      () =>
        serializeGraph(graph),
  },
  {
    name: 'persistence: save document',
    setup: (fixture) => {
      const { host, store, ids } = open(fixture)
      const persistence = connectPersistence(host, createFileStorage(fixture.directory), {
        blocked: [],
        issues: [],
      })
      let count = 0
      return {
        prepare: () =>
          store.applyOperations([{ kind: 'concept.label', id: ids[0], value: `Saved ${count++}` }]),
        run: () => persistence.flush(),
      }
    },
  },
  {
    name: 'persistence: load document',
    setup:
      ({ directory }) =>
      async () =>
        initializeNessoStore(await loadPersistence(createFileStorage(directory)), ['en']),
  },
  {
    name: 'plugins: materialize map',
    setup: ({ graph, workspace }) => {
      const id = workspace.maps.at(-1)?.id ?? null
      return () => materialize(graph, { ...workspace, activeMapId: id })
    },
  },
  {
    name: 'graph: settle layout',
    setup: ({ graph, workspace }) => {
      const visible = materialize(graph, { ...workspace, activeMapId: null })
      return () => settle(visible, new Map())
    },
  },
  {
    name: 'graph: update scene',
    setup: ({ graph, workspace }) => {
      const visible = materialize(graph, { ...workspace, activeMapId: null })
      const layout = new Map()
      const byId = new Map(settle(visible, layout).bubbles.map((bubble) => [bubble.id, bubble]))
      return () => scene(visible, layout, byId)
    },
  },
  {
    name: 'map: build elements',
    setup: (fixture) => {
      const { store } = open(fixture)
      const mapGraph = presentedGraph(store.getState())
      return () => {
        const adapt = createGraphElements()
        adapt({
          graph: mapGraph,
          indexed: indexGraph(mapGraph),
          groups: groupRelations(mapGraph),
          selected: [],
          sizes: {},
          label: ({ predicate }) => predicate,
        })
      }
    },
  },
]

export type Sample = { readonly name: string; readonly size: number; readonly samples: number[] }

export async function runBenchmarks({
  sizes,
  filter,
  profile,
}: {
  sizes: readonly number[]
  filter?: string
  profile?: (name: string, size: number, run: () => Promise<void>) => Promise<void>
}): Promise<Sample[]> {
  const selected = benchmarks.filter(({ name }) => !filter || name.includes(filter))
  const results: Sample[] = []
  for (const size of sizes) {
    const options = defaultGraphOptions(size)
    const directory = await mkdtemp(path.join(tmpdir(), 'nesso-perf-'))
    try {
      await writeDocument(directory, options)
      const fixture = { ...generateGraph(options), directory }
      for (const { name, setup } of selected) {
        const benchmark = setup(fixture)
        const { prepare, run } =
          typeof benchmark === 'function' ? { prepare: undefined, run: benchmark } : benchmark
        const samples: number[] = []
        const measure = async () => {
          prepare?.()
          const start = performance.now()
          await run()
          samples.push(performance.now() - start)
        }
        await measure()
        samples.length = 0
        globalThis.gc?.()
        const sample = async () => {
          const start = performance.now()
          while (samples.length < 3 || (performance.now() - start < 1000 && samples.length < 1000))
            await measure()
        }
        await (profile ? profile(name, size, sample) : sample())
        results.push({ name, size, samples })
        process.stderr.write(`${name} @ ${size}: ${samples.length} samples\n`)
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
  return results
}
