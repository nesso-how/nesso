import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseGraph } from '@nesso/schema'
import seed from './seed-graph.json' with { type: 'json' }
import seedViews from './seed-views.json' with { type: 'json' }
import { createSeedDocument } from './seed.ts'

test('seed translations cover every label and view name without changing document structure', () => {
  const english = createSeedDocument('en')
  assert.deepEqual(english.graph, parseGraph(seed))
  assert.deepEqual(english.workspace, { activeViewId: null, savedViews: seedViews, viewports: {} })
  for (const locale of ['it', 'zh-CN'] as const) {
    const translation: Record<'conceptLabels' | 'conceptDescriptions' | 'relationTypeLabels' | 'viewNames', Record<string, string>> = JSON.parse(
      readFileSync(new URL(`./seed-translations/${locale}.json`, import.meta.url), 'utf8'),
    )
    assert.deepEqual(Object.keys(translation.conceptLabels).sort(), english.graph.concepts.map(({ id }) => id).sort(), locale)
    assert.deepEqual(Object.keys(translation.conceptDescriptions).sort(), english.graph.concepts.map(({ id }) => id).sort(), locale)
    assert.deepEqual(Object.keys(translation.relationTypeLabels).sort(), english.graph.relationTypes.map(({ id }) => id).sort(), locale)
    assert.deepEqual(Object.keys(translation.viewNames).sort(), seedViews.map(({ id }) => id).sort(), locale)
    for (const labels of Object.values(translation)) {
      for (const label of Object.values(labels)) assert.ok(typeof label === 'string' && label.trim(), locale)
    }
    const translated = createSeedDocument(locale)
    assert.deepEqual(translated.graph, {
      ...english.graph,
      concepts: english.graph.concepts.map((concept) => ({
        ...concept,
        label: translation.conceptLabels[concept.id],
        description: translation.conceptDescriptions[concept.id],
      })),
      relationTypes: english.graph.relationTypes.map((type) => ({ ...type, label: translation.relationTypeLabels[type.id] })),
    })
    assert.deepEqual(translated.workspace, {
      ...english.workspace,
      savedViews: seedViews.map((view) => ({ ...view, name: translation.viewNames[view.id] })),
    })
  }
})
