import type { ViewGraphSnapshot } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, serializeGraph } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

function serializeView(graph: ViewGraphSnapshot, name?: string) {
  const members = graph.concepts.flatMap(({ id, position, color, bold, italic }) =>
    position ? [{ id, position: { ...position }, color, bold, italic }] : [],
  )
  return serializeGraph(
    {
      concepts: graph.concepts.map(({ id, label, notes }) => ({ id, label, notes })),
      relationTypes: graph.relationTypes.map((type) => ({ ...type })),
      relations: graph.relations.map((relation) => ({ ...relation })),
    },
    name === undefined ? [] : [{ id: newIri(), name, members }],
  )
}

export const create = (): readonly ActionContribution[] =>
  (['jsonld', 'png'] as const).map((format) => ({
    id: format === 'png' ? 'export-png' : 'export',
    label: format === 'png' ? i18n.pngLabel : i18n.label,
    icon: 'download',
    run: async ({ document, files, images, notifications, viewId }) => {
      const state = await document.refresh()
      const view = state.workspace.savedViews.find(({ id }) => id === viewId)
      const name = view?.name ?? 'graph'
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
              text: JSON.stringify(serializeView(state.viewGraph, view?.name), null, 2),
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
