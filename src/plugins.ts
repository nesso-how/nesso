import { exportPlugin } from '@nesso/export'
import { graphPlugin } from '@nesso/graph'
import { themePlugin } from '@nesso/theme'
import { vocabPlugin } from '@nesso/vocab'
import { Monitor, Palette, Shapes, Zap } from 'lucide-react'
import { nessoStore, registerRenderer, registerTheme, registerVocab } from '@/store'
import graphPackage from '../plugins/graph/package.json'
import themePackage from '../plugins/theme/package.json'
import vocabPackage from '../plugins/vocab/package.json'
import exportPackage from '../plugins/export/package.json'
import { createPluginStore } from './store/commands.ts'

const bundledPlugins = [
  { plugin: graphPlugin, manifest: graphPackage },
  { plugin: themePlugin, manifest: themePackage },
  { plugin: vocabPlugin, manifest: vocabPackage },
  { plugin: exportPlugin, manifest: exportPackage },
] as const

const icons = { renderer: Monitor, theme: Palette, vocab: Shapes, actions: Zap }

export const plugins = bundledPlugins.map(({ plugin, manifest }) => {
  const entry = { id: manifest.name, version: manifest.version, icon: icons[plugin.kind], metadata: plugin.metadata }
  const context = { store: createPluginStore(nessoStore, plugin.operations) }
  switch (plugin.kind) {
    case 'renderer': {
      const contribution = plugin.create(context)
      registerRenderer(contribution)
      return { ...entry, kind: plugin.kind, contribution }
    }
    case 'theme': {
      const contribution = plugin.create(context)
      registerTheme(contribution)
      return { ...entry, kind: plugin.kind, contribution }
    }
    case 'vocab': {
      const contribution = plugin.create(context)
      registerVocab(contribution)
      return { ...entry, kind: plugin.kind, contribution }
    }
    case 'actions':
      return { ...entry, kind: plugin.kind, contribution: plugin.create(context) }
  }
})

export const actions = plugins.flatMap((plugin) => plugin.kind === 'actions' ? plugin.contribution : [])
