import type { GraphSnapshot, Plugin } from '@nesso/plugin'
import { serializeGraph, type Graph } from '@nesso/schema'
import { createTranslator } from '@nesso/i18n'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }

const translate = createTranslator(en, { it })

export const downloadGraph = (graph: GraphSnapshot, name = 'graph'): void => {
  const blob = new Blob([JSON.stringify(serializeGraph(structuredClone(graph) as Graph), null, 2)], {
    type: 'application/ld+json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  const filename = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'view'
  anchor.download = `nesso-${filename}.jsonld`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportPlugin: Plugin = {
  kind: 'actions',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: [],
  create: ({ store }) => {
    const runOnView = (viewId: string | null) => {
      const state = store.getState()
      const view = viewId ? state.workspace.savedViews.find((item) => item.id === viewId) : undefined
      downloadGraph(viewId ? store.getViewGraph(viewId) : state.viewGraph, view?.name ?? 'graph')
    }
    return [{
      id: 'export-view',
      label: (locale) => translate(locale)('exportView'),
      run: () => runOnView(store.getState().workspace.activeViewId),
      runOnView,
    }]
  },
}
