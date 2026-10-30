import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { serializeGraph, type Graph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export const create = (): readonly ActionContribution[] => [
  {
    id: 'export-view',
    label: i18n.label,
    icon: 'download',
    run: async ({ document, files, notifications, viewId }) => {
      const state = await document.refresh()
      const name = state.workspace.savedViews.find(({ id }) => id === viewId)?.name ?? 'graph'
      const filename =
        name
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'view'
      const result = await files.save({
        name: `nesso-${filename}.jsonld`,
        mediaType: 'application/ld+json',
        text: JSON.stringify(serializeGraph(structuredClone(state.viewGraph) as Graph), null, 2),
      })
      if (!result.saved) return
      await notifications.notify({
        tone: 'info',
        title: i18n.viewExported,
        description: i18n.viewExportedDescription,
      })
    },
  },
]
