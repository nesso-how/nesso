import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { serializeGraph, type Graph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

export const create = (): readonly ActionContribution[] =>
  (['jsonld', 'png'] as const).map((format) => ({
    id: format === 'png' ? 'export-png' : 'export',
    label: format === 'png' ? i18n.pngLabel : i18n.label,
    icon: 'download',
    run: async ({ document, files, images, notifications, viewId }) => {
      const state = await document.refresh()
      const name = state.workspace.savedViews.find(({ id }) => id === viewId)?.name ?? 'graph'
      const filename =
        name
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'view'
      const result = await files.save({
        name: `nesso-${filename}.${format}`,
        ...(format === 'png'
          ? await images.renderView({ format: 'png', scale: 4 })
          : {
              mediaType: 'application/ld+json',
              text: JSON.stringify(
                serializeGraph(structuredClone(state.viewGraph) as Graph),
                null,
                2,
              ),
            }),
      })
      if (!result.saved) return
      await notifications.notify({
        tone: 'info',
        title: i18n.viewExported,
        description: format === 'png' ? i18n.pngExportedDescription : i18n.viewExportedDescription,
      })
    },
  }))
