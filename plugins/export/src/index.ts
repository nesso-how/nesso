import type { ActionContext, ActionContribution } from '@nesso-how/plugin/runtime'
import { PluginError } from '@nesso-how/plugin'
import { serializeGraph, type Graph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

class ExportError extends PluginError {
  override name = 'ExportError'
  constructor() { super('failed', [{ path: 'export', message: 'View reads are unavailable' }]) }
}

export const create = ({ store, files, notifications }: ActionContext): readonly ActionContribution[] => [{
  id: 'export-view', label: i18n.label,
  run: async ({ viewId }) => {
    const state = await store.refresh()
    if (!('viewGraph' in state)) throw new ExportError()
    const name = state.workspace.savedViews.find(({ id }) => id === viewId)?.name ?? 'graph'
    const filename = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'view'
    const result = await files.save({ name: `nesso-${filename}.jsonld`, mediaType: 'application/ld+json', text: JSON.stringify(serializeGraph(structuredClone(state.viewGraph) as Graph), null, 2) })
    if (!result.saved) return
    await notifications.notify({ tone: 'info', title: i18n.viewExported, description: i18n.viewExportedDescription })
  },
}]
