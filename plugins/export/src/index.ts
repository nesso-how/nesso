import type { GraphSnapshot, Plugin } from '@nesso/plugin'
import { serializeGraph, type Graph } from '@nesso/schema'
import { createTranslator, defaultLocale } from '@nesso/i18n'
import en from './i18n/en.json' with { type: 'json' }
import it from './i18n/it.json' with { type: 'json' }
import zhCN from './i18n/zh-CN.json' with { type: 'json' }

const translate = createTranslator(en, { it, 'zh-CN': zhCN })

type PickerFile = { readonly write: (data: string) => Promise<void>; readonly close: () => Promise<void> }
type PickerHost = {
  readonly showSaveFilePicker?: (options: { readonly suggestedName: string }) => Promise<{
    readonly createWritable: () => Promise<PickerFile>
  }>
}

const exportFileName = (name: string): string => {
  const slug = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'view'
  return `nesso-${slug}.jsonld`
}

const serializeView = (graph: GraphSnapshot): string =>
  JSON.stringify(serializeGraph(structuredClone(graph) as Graph), null, 2)

export const downloadGraph = (graph: GraphSnapshot, name = 'graph'): void => {
  const blob = new Blob([serializeView(graph)], {
    type: 'application/ld+json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = exportFileName(name)
  anchor.click()
  URL.revokeObjectURL(url)
}

const saveGraph = async (graph: GraphSnapshot, name: string): Promise<boolean> => {
  const picker = (globalThis as PickerHost).showSaveFilePicker
  if (!picker) {
    downloadGraph(graph, name)
    return true
  }
  const content = serializeView(graph)
  const handle = await picker({ suggestedName: exportFileName(name) }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  })
  if (!handle) return false
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  return true
}

export const exportPlugin: Plugin = {
  kind: 'actions',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: [],
  create: ({ store, notifications }) => {
    const runOnView = async (viewId: string | null): Promise<void> => {
      const state = store.getState()
      const view = viewId ? state.workspace.savedViews.find((item) => item.id === viewId) : undefined
      const saved = await saveGraph(viewId ? store.getViewGraph(viewId) : state.viewGraph, view?.name ?? 'graph')
      if (!saved) return
      const t = translate(state.preferences.locale ?? defaultLocale)
      notifications.notify({ tone: 'info', title: t('viewExported'), description: t('viewExportedDescription') })
    }
    return [{
      id: 'export-view',
      label: (locale) => translate(locale)('exportView'),
      run: () => runOnView(store.getState().workspace.activeViewId),
      runOnView,
    }]
  },
}
