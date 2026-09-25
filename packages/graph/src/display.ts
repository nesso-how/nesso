// SPDX-License-Identifier: MIT
import type { RelationTypeName } from '@nesso-how/vocab-learning'

export type EdgeEncoding = 'full' | 'category' | 'minimal'
export type CurveStyle = 'arc' | 'straight'

/**
 * First defined value wins: explicit prop > document display > built-in
 * default. Keeps the `NessoGraph` context merge flat as display keys grow —
 * a `??` chain per key would push the memo past the complexity budget.
 */
export function pickDisplay<T>(prop: T | undefined, doc: T | undefined, fallback: T): T {
  return prop ?? doc ?? fallback
}

export interface GraphDisplaySettings {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  /** Dim edges unconnected to the selected concept. Per-map, default on. */
  dimUnconnectedOnSelect: boolean
}

/** Single source of truth for graph display defaults (package + app). */
export const DEFAULT_GRAPH_DISPLAY: GraphDisplaySettings = {
  edgeEncoding: 'full',
  showHeatmap: true,
  curveStyle: 'arc',
  dimUnconnectedOnSelect: true,
}

export interface NessoEdgeData extends Record<string, unknown> {
  type: RelationTypeName
  siblingIdx?: number
  /**
   * Signed multiplier of the default arc bow: 1 = default side, -1 = mirrored,
   * 0 = straight, |offset| > 1 exaggerates the bow. Absent = default bow.
   */
  curveOffset?: number
  /** Endpoint positions relative to the padded concept box; absent = automatic exit. */
  sourceAttachment?: { x: number; y: number }
  targetAttachment?: { x: number; y: number }
  /**
   * Manual curve reshape: a point on the arc, normalized to the source node's
   * padded box (centre 0,0, axes -1..1 per half-size), grabbed at curve
   * parameter `t` in (0,1). Supersedes `curveOffset` when present.
   */
  curveAnchor?: CurveAnchor
}

/** Persisted reshape point of a manually bent arc (see {@link NessoEdgeData}). */
export interface CurveAnchor {
  x: number
  y: number
  t: number
}
