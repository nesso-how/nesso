import type { HostStore } from '../store/types.ts'
import { materialize } from '../store/operations.ts'
import { NessoError } from '@nesso-how/errors'
import {
  PluginError,
  themeTokens,
  type ImageRenderOptions,
  type RenderedImage,
} from '@nesso-how/plugin/runtime'

class ViewImageError extends NessoError {
  override name = 'ViewImageError'
}

export async function renderViewImage(
  store: HostStore,
  viewId: string | null,
  options: ImageRenderOptions,
  signal: AbortSignal,
): Promise<RenderedImage> {
  const canvas = await renderViewCanvas(store, viewId, options, signal)
  const fail = (message: string) => new ViewImageError([{ path: 'image', message }])
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(fail('Could not encode PNG'))),
      'image/png',
    ),
  )
  if (blob.size > 16 * 1024 * 1024) throw fail('Image exceeds the file byte budget')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (signal.aborted) throw fail('Image rendering cancelled')
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return { mediaType: 'image/png', base64: btoa(binary) }
}

async function renderViewCanvas(
  store: HostStore,
  viewId: string | null,
  options: ImageRenderOptions,
  signal: AbortSignal,
) {
  const state = store.getState()
  const style = getComputedStyle(document.documentElement)
  const theme = Object.fromEntries(
    themeTokens.map((token) => [token, style.getPropertyValue(`--${token}`).trim()]),
  )
  if (viewId === null) {
    const { renderKnowledgeGraphImage } = await import('@nesso-how/knowledge-graph/image')
    return renderKnowledgeGraphImage({
      state,
      layout: store.knowledgeGraphLayout,
      theme,
      scale: options.scale,
      signal,
    })
  }
  const presentation = store.getConceptMapPresentation()
  const snapshot = {
    ...state,
    workspace: { ...state.workspace, activeViewId: viewId },
    viewGraph: materialize(state.graph, { ...state.workspace, activeViewId: viewId }),
    selected: [],
  }
  const { renderConceptMapImage } = await import('@nesso-how/concept-map/image')
  const readOnly = () => {
    throw new PluginError('denied', [{ path: 'image', message: 'Image rendering is read-only' }])
  }
  return renderConceptMapImage({
    presentation,
    store: {
      getState: () => snapshot,
      subscribe: () => () => {},
      applyOperations: readOnly,
      undo: readOnly,
      redo: readOnly,
      conceptPlacementOffset: store.conceptPlacementOffset,
    },
    theme,
    scale: options.scale,
    signal,
  })
}
