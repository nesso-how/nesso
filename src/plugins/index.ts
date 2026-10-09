import { exportPlugin } from '@nesso/export'
import { conceptMapPlugin } from '@nesso/concept-map'
import { importPlugin } from '@nesso/import'
import { kernelPlugin } from '@nesso/kernel'
import { baseVocabPlugin } from '@nesso/base-vocab'
import { Monitor, Palette, Shapes, Zap } from 'lucide-react'
import { nessoStore, registerRenderer, registerTheme, registerVocab } from '@/store'
import conceptMapPackage from '../../plugins/concept-map/package.json'
import kernelPackage from '../../plugins/kernel/package.json'
import baseVocabPackage from '../../plugins/base-vocab/package.json'
import exportPackage from '../../plugins/export/package.json'
import importPackage from '../../plugins/import/package.json'
import { createPluginStore } from '../store/commands.ts'
import { notifications } from '../notifications/index.ts'

const bundledPlugins = [
  { plugin: conceptMapPlugin, manifest: conceptMapPackage },
  { plugin: kernelPlugin, manifest: kernelPackage },
  { plugin: baseVocabPlugin, manifest: baseVocabPackage },
  { plugin: exportPlugin, manifest: exportPackage },
  { plugin: importPlugin, manifest: importPackage },
] as const

const icons = { renderer: Monitor, theme: Palette, vocab: Shapes, actions: Zap }

export const plugins = bundledPlugins.map(({ plugin, manifest }) => {
  const entry = { id: manifest.name, version: manifest.version, icon: icons[plugin.kind], metadata: plugin.metadata }
  const context = { store: createPluginStore(nessoStore, plugin.operations), notifications: notifications.api }
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

export const viewActions = plugins.flatMap((plugin) => plugin.kind === 'actions'
  ? plugin.contribution.filter((action) => action.runOnView !== undefined) : [])
