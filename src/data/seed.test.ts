import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseGraph } from '@nesso-how/schema'
import seed from './seed-graph.json' with { type: 'json' }
import seedMaps from './seed-maps.json' with { type: 'json' }
import { createSeedDocument } from './seed.ts'

test('seed translations cover every label and map name without changing document structure', () => {
  const english = createSeedDocument('en')
  assert.deepEqual(parseGraph(seed), { graph: english.graph, maps: [] })
  assert.deepEqual(english.workspace, {
    activeMapId: seedMaps[0].id,
    mapGroups: [],
    maps: seedMaps,
    viewports: {},
  })
  for (const locale of ['it', 'zh-CN'] as const) {
    const translation: Record<
      'conceptLabels' | 'conceptNotes' | 'relationTypeLabels' | 'mapNames',
      Record<string, string>
    > = JSON.parse(
      readFileSync(new URL(`./seed-translations/${locale}.json`, import.meta.url), 'utf8'),
    )
    assert.deepEqual(
      Object.keys(translation.conceptLabels).sort(),
      english.graph.concepts.map(({ id }) => id).sort(),
      locale,
    )
    assert.deepEqual(
      Object.keys(translation.conceptNotes).sort(),
      english.graph.concepts.map(({ id }) => id).sort(),
      locale,
    )
    assert.deepEqual(
      Object.keys(translation.relationTypeLabels).sort(),
      english.graph.relationTypes.map(({ id }) => id).sort(),
      locale,
    )
    assert.deepEqual(
      Object.keys(translation.mapNames).sort(),
      seedMaps.map(({ id }) => id).sort(),
      locale,
    )
    for (const labels of Object.values(translation)) {
      for (const label of Object.values(labels))
        assert.ok(typeof label === 'string' && label.trim(), locale)
    }
    const translated = createSeedDocument(locale)
    assert.deepEqual(translated.graph, {
      ...english.graph,
      concepts: english.graph.concepts.map((concept) => ({
        ...concept,
        label: translation.conceptLabels[concept.id],
        notes: translation.conceptNotes[concept.id],
      })),
      relationTypes: english.graph.relationTypes.map((type) => ({
        ...type,
        label: translation.relationTypeLabels[type.id],
      })),
    })
    assert.deepEqual(translated.workspace, {
      ...english.workspace,
      maps: seedMaps.map((map) => ({ ...map, name: translation.mapNames[map.id] })),
    })
  }
})
