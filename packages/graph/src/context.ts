// SPDX-License-Identifier: MIT
import { createContext, useContext } from 'react'
import type { RelationTypeName, CategoryPalette } from '@nesso-how/vocab-learning'
import type { EdgeEncoding, CurveStyle } from './display.js'

export type CategoryColorMode = 'palette' | 'css'

export interface NessoGraphDisplayContext {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
  palette: CategoryPalette
  /** `palette` uses hex from PALETTES; `css` uses `var(--cat-*)` (app with live palette switching). */
  categoryColorMode: CategoryColorMode
  getRelationLabel?: (type: RelationTypeName) => string
  isItemSelected?: (kind: 'node' | 'edge', id: string) => boolean
  /** Id of the currently selected concept, if any — used to emphasize connected edges. */
  selectedNodeId?: string | null
  /** Dim edges unconnected to the selected concept. Defaults to on. */
  dimUnconnectedOnSelect: boolean
}

const defaultContext: NessoGraphDisplayContext = {
  edgeEncoding: 'full',
  showHeatmap: true,
  curveStyle: 'arc',
  autoCurveFlip: true,
  palette: 'default',
  categoryColorMode: 'palette',
  dimUnconnectedOnSelect: true,
}

export const GraphDisplayContext = createContext<NessoGraphDisplayContext>(defaultContext)

export function useGraphDisplay(): NessoGraphDisplayContext {
  return useContext(GraphDisplayContext)
}
