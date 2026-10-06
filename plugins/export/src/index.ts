import type { GraphSnapshot, Plugin } from '@nesso/plugin'
import { serializeGraph, type Graph } from '@nesso/schema'

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

export const exportPlugin: Plugin = ({ store }) => ({
  actions: [{
    id: 'export-view',
    label: 'Export view',
    run: () => downloadGraph(store.getState().viewGraph),
  }],
})
