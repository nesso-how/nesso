import type { ActionDefinition, Plugin } from '@nesso/plugin'
import { exportPlugin } from '@nesso/export'
import { graphPlugin } from '@nesso/graph'
import { vocabPlugin } from '@nesso/vocab'
import { nessoStore, registerRenderer, registerVocab } from '@/store'

const plugins: readonly Plugin[] = [vocabPlugin, graphPlugin, exportPlugin]

export const actions: ActionDefinition[] = []

for (const plugin of plugins) {
  const definition = plugin({ store: nessoStore })
  for (const vocab of definition.vocabs ?? []) registerVocab(vocab)
  for (const renderer of definition.renderers ?? []) registerRenderer(renderer)
  actions.push(...(definition.actions ?? []))
}
