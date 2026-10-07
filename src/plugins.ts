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
  const context = { store: createPluginStore(nessoStore, plugin.operations) }
  switch (plugin.kind) {
    case 'renderer':
      registerRenderer(plugin.create(context))
      break
    case 'theme':
      registerTheme(plugin.create(context))
      break
    case 'vocab':
      registerVocab(plugin.create(context))
      break
    case 'actions':
      actions.push(...plugin.create(context))
      break
  }
}
