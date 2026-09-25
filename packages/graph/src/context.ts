// SPDX-License-Identifier: MIT
import { createContext, useContext } from 'react'
import type { RelationTypeName, CategoryPalette } from '@nesso-how/vocab-learning'
import type { EdgeEncoding, CurveStyle } from './display.js'
import { DEFAULT_GRAPH_DISPLAY } from './display.js'
import type { EndpointAttachment } from './geometry.js'

export type CategoryColorMode = 'palette' | 'css'

export interface NessoGraphDisplayContext {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  palette: CategoryPalette
  /** `palette` uses hex from PALETTES; `css` uses `var(--cat-*)` (app with live palette switching). */
  categoryColorMode: CategoryColorMode
  getRelationLabel?: (type: RelationTypeName) => string
  isItemSelected?: (kind: 'node' | 'edge', id: string) => boolean
  /**
   * Curve-reshape commit callback (see NessoGraphProps). Receives the anchor
   * (source-node-relative point + curve parameter) once per completed drag,
   * or undefined when the curve is reset to the default bow. Absent = read-only.
   */
  onEdgeCurveAnchorChange?: (
    id: string,
    anchor: { x: number; y: number; t: number } | undefined,
  ) => void
  /**
   * Endpoint-retarget callback (see NessoGraphProps). Absent = no reconnect dots.
   */
  onEdgeReconnect?: (
    id: string,
    side: 'source' | 'target',
    nodeId: string,
    attachment?: EndpointAttachment,
    curveAnchor?: { x: number; y: number; t: number },
  ) => void
  /**
   * Reconnect hover callback: the hovered concept id while an endpoint drag
   * is over a valid target, or null. Drives the destination highlight.
   */
  onEdgeReconnectOver?: (nodeId: string | null) => void
  /** Id of the currently selected concept, if any — used to emphasize connected edges. */
  selectedNodeId?: string | null
  /**
   * The currently selected relation with its endpoints, if any — used to focus
   * the map on it: the arc and its source/target concepts stay highlighted
   * while the rest dims.
   */
  selectedEdge?: { id: string; source: string; target: string } | null
  /** Dim edges unconnected to the selected concept. Defaults to on. */
  dimUnconnectedOnSelect: boolean
}

const defaultContext: NessoGraphDisplayContext = {
  ...DEFAULT_GRAPH_DISPLAY,
  palette: 'default',
  categoryColorMode: 'palette',
}

export const GraphDisplayContext = createContext<NessoGraphDisplayContext>(defaultContext)

export function useGraphDisplay(): NessoGraphDisplayContext {
  return useContext(GraphDisplayContext)
}
