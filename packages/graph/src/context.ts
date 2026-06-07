// SPDX-License-Identifier: MIT
import { createContext, useContext } from 'react'
import type { EdgeTypeName } from '@nesso-how/relation-types'
import type { EdgeEncoding, CurveStyle, CategoryPalette } from '@nesso-how/types'

export type CategoryColorMode = 'palette' | 'css'

export interface NessoGraphDisplayContext {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
  palette: CategoryPalette
  showConfidence: boolean
  /** `palette` uses hex from PALETTES; `css` uses `var(--cat-*)` (app with live palette switching). */
  categoryColorMode: CategoryColorMode
  getRelationLabel?: (type: EdgeTypeName) => string
  isItemSelected?: (kind: 'node' | 'edge', id: string) => boolean
}

const defaultContext: NessoGraphDisplayContext = {
  edgeEncoding: 'full',
  showHeatmap: true,
  curveStyle: 'arc',
  autoCurveFlip: true,
  palette: 'default',
  showConfidence: false,
  categoryColorMode: 'palette',
}

export const GraphDisplayContext = createContext<NessoGraphDisplayContext>(defaultContext)

export function useGraphDisplay(): NessoGraphDisplayContext {
  return useContext(GraphDisplayContext)
}
