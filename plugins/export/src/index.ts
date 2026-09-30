import type { GraphSnapshot, Plugin } from '@nesso/plugin'
import { serializeGraph, type Graph } from '@nesso/schema'

const download = (graph: GraphSnapshot): void => {
  const blob = new Blob([JSON.stringify(serializeGraph(structuredClone(graph) as Graph), null, 2)], {
    type: 'application/ld+json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'nesso-graph.jsonld'
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportPlugin: Plugin = ({ store }) => ({
  actions: [{
    id: 'export-view',
    label: 'Export',
    run: () => download(store.getState().viewGraph),
  }],
})
