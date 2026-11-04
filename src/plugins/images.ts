import type { HostStore } from '../store/types.ts'
import { materialize } from '../store/operations.ts'
import { PluginError, themeTokens, type ImageRenderOptions } from '@nesso-how/plugin/runtime'

export async function renderViewImage(
  store: HostStore,
  viewId: string | null,
  options: ImageRenderOptions,
  signal: AbortSignal,
) {
  const state = store.getState()
  const snapshot = {
    ...state,
    viewGraph: materialize(state.graph, { ...state.workspace, activeViewId: viewId }),
    selected: [],
  }
  const style = getComputedStyle(document.documentElement)
  const theme = Object.fromEntries(
    themeTokens.map((token) => [token, style.getPropertyValue(`--${token}`).trim()]),
  )
  const fontStyles = document.querySelector('style[data-nesso-theme-fonts]')?.textContent ?? ''
  const { renderConceptMapImage } = await import('@nesso-how/concept-map/image')
  const readOnly = () => {
    throw new PluginError('denied', [{ path: 'image', message: 'Image rendering is read-only' }])
  }
  return renderConceptMapImage({
    store: {
      getState: () => snapshot,
      subscribe: () => () => {},
      applyOperations: readOnly,
      undo: readOnly,
      redo: readOnly,
      conceptPlacementOffset: store.conceptPlacementOffset,
    },
    theme,
    fontStyles,
    scale: options.scale,
    signal,
  })
}
