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
  autoCurveFlip: boolean
  /** Dim edges unconnected to the selected concept. Per-map, default on. */
  dimUnconnectedOnSelect: boolean
}

export interface NessoEdgeData extends Record<string, unknown> {
  type: RelationTypeName
  siblingIdx?: number
  curveFlip?: boolean
  curveFlipPinned?: boolean
}
