// SPDX-License-Identifier: MIT
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { deserialize, serialize } from '@nesso-how/vocab-learning'
import { graphToDocument } from '@/lib/graphDocumentMapping'
import { documentToGraph } from '@/lib/graphMapping'
import { useGraphStore } from '@/store'
import { getT } from '@/i18n'
import { toast } from '@/components/ui/toast'
import { exportShareGraphJson } from '@/lib/saveJsonFile'
import { track } from '@/telemetry'
import type { FailureReason } from '@/telemetry'

function mapErrorToFailureReason(err: unknown): FailureReason {
  if (err instanceof SyntaxError) return 'invalid_file'
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    if (msg.includes('fetch') || msg.includes('network')) return 'network'
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, number | undefined>
    if (typeof obj.status === 'number' && obj.status >= 400) return 'response'
  }
  return 'unsupported'
}

/** Serializes the active graph to JSON and triggers a file download / save dialog. */
export async function exportGraphJson(): Promise<void> {
  const { nodes, edges, graphList, currentGraphId, graphDisplay } = useGraphStore.getState()
  const meta = graphList.find((g) => g.id === currentGraphId)
  const name = meta?.name ?? 'graph'
  const filename = `${name}.json`
  try {
    const payload = serialize(graphToDocument({ name, nodes, edges, display: graphDisplay }))
    await exportShareGraphJson(filename, payload)
    track({ name: 'graph_exported', props: { format: 'json' } })
  } catch (err) {
    track({
      name: 'graph_export_failed',
      props: { format: 'json', reason: mapErrorToFailureReason(err) },
    })
    throw err
  }
}

/** Renders the current React Flow viewport to a PNG and downloads it. */
export async function exportGraphPng(): Promise<void> {
  const { nodes, graphList, currentGraphId } = useGraphStore.getState()
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || nodes.length === 0) return
  const meta = graphList.find((g) => g.id === currentGraphId)
  const name = meta?.name ?? 'graph'

  const padding = 64
  const imageWidth = 1920
  const imageHeight = 1200
  const bounds = getNodesBounds(nodes)
  const fitted = getViewportForBounds(
    bounds,
    imageWidth - padding * 2,
    imageHeight - padding * 2,
    0.15,
    2.5,
    0,
  )
  const tx = fitted.x + padding
  const ty = fitted.y + padding
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#ffffff'

  try {
    const dataUrl = await toPng(viewport, {
      backgroundColor: bg,
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 2,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${tx}px, ${ty}px) scale(${fitted.zoom})`,
      },
      filter: (el) => {
        // React Flow draws handles/selection chrome that don't belong in an export.
        if (!(el instanceof Element)) return true
        if (el.classList.contains('react-flow__handle')) return false
        if (el.classList.contains('react-flow__edge-handle')) return false
        return true
      },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${name}.png`
    a.click()
    track({ name: 'graph_exported', props: { format: 'png' } })
  } catch (err) {
    track({
      name: 'graph_export_failed',
      props: { format: 'png', reason: mapErrorToFailureReason(err) },
    })
  }
}

/** Imports a graph from a file object — parse, validate, persist, and track telemetry. */
export async function importGraphFromFile(file: File): Promise<void> {
  try {
    const doc = deserialize(await file.text())
    const name = doc.name?.trim() || file.name.replace(/\.json$/i, '')
    const { nodes, edges, display } = await documentToGraph(doc, '')
    await useGraphStore.getState().importGraph(name, nodes, edges, display, doc.id)
    track({ name: 'graph_imported' })
  } catch (err) {
    track({
      name: 'graph_import_failed',
      props: { format: 'json', reason: mapErrorToFailureReason(err) },
    })
    throw err
  }
}

/** Opens a file picker and imports the chosen Nesso graph JSON as a new graph. */
export function importGraphFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      await importGraphFromFile(file)
    } catch {
      toast.error(getT().graphIO.importError.replace('{name}', file.name))
    }
  }
  input.click()
}
