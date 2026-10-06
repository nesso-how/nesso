import type { ActionDefinition, Plugin } from '@nesso/plugin'
import { exportPlugin } from '@nesso/export'
import { graphPlugin } from '@nesso/graph'
import { themePlugin } from '@nesso/theme'
import { vocabPlugin } from '@nesso/vocab'
import { nessoStore, registerRenderer, registerTheme, registerVocab } from '@/store'
import { createPluginStore } from './store/commands.ts'

const plugins: readonly Plugin[] = [themePlugin, vocabPlugin, graphPlugin, exportPlugin]

export const actions: ActionDefinition[] = []

for (const plugin of plugins) {
  const definition = plugin.create({ store: createPluginStore(nessoStore, plugin.operations) })
  for (const vocab of definition.vocabs ?? []) registerVocab(vocab)
  for (const renderer of definition.renderers ?? []) registerRenderer(renderer)
  for (const theme of definition.themes ?? []) registerTheme(theme)
  actions.push(...(definition.actions ?? []))
}
