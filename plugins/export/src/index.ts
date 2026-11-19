import type { MapGraphSnapshot } from '@nesso-how/plugin'
import type { ActionContribution } from '@nesso-how/plugin/runtime'
import { newIri, serializeGraph, type RelationBend } from '@nesso-how/schema'
import source from '../package.json' with { type: 'json' }

const { i18n } = source

function serializeMap(graph: MapGraphSnapshot, name?: string) {
  const members = graph.concepts.flatMap(({ id, position, color, bold, italic, strikethrough }) =>
    position ? [{ id, position: { ...position }, color, bold, italic, strikethrough }] : [],
  )
  const relationBends = graph.relations.flatMap(({ bend, ...relation }): RelationBend[] =>
    bend ? [{ ...relation, bend }] : [],
  )
  return serializeGraph(
    {
      concepts: graph.concepts.map(({ id, label, notes }) => ({ id, label, notes })),
      relationTypes: graph.relationTypes.map((type) => ({ ...type })),
      relations: graph.relations.map(({ source, predicate, target }) => ({
        source,
        predicate,
        target,
      })),
    },
    name === undefined ? [] : [{ id: newIri(), name, members, relationBends }],
  )
}

export const create = (): readonly ActionContribution[] =>
  (['jsonld', 'png'] as const).map((format) => ({
    id: format === 'png' ? 'export-png' : 'export',
    label: format === 'png' ? i18n.pngLabel : i18n.label,
    icon: 'download',
    run: async ({ document, files, images, notifications, mapId }) => {
      const state = await document.refresh()
      const map = state.workspace.maps.find(({ id }) => id === mapId)
      const name = map?.name ?? 'graph'
      const filename =
        name
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'map'
      const result = await files.save({
        name: `nesso-${filename}.${format}`,
        ...(format === 'png'
          ? await images.renderCanvas({ format: 'png', scale: 4 })
          : {
              mediaType: 'application/ld+json',
              text: JSON.stringify(serializeMap(state.mapGraph, map?.name), null, 2),
            }),
      })
      if (!result.saved) return
      await notifications.notify({
        tone: 'info',
        title: i18n.mapExported,
        description: format === 'png' ? i18n.pngExportedDescription : i18n.mapExportedDescription,
      })
    },
  }))
