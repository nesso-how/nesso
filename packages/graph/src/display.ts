// SPDX-License-Identifier: MIT
import type { RelationTypeName } from '@nesso-how/vocab-learning'

export type EdgeEncoding = 'full' | 'category' | 'minimal'
export type CurveStyle = 'arc' | 'straight'

export interface GraphDisplaySettings {
  edgeEncoding: EdgeEncoding
  showHeatmap: boolean
  curveStyle: CurveStyle
  autoCurveFlip: boolean
}

export interface NessoEdgeData extends Record<string, unknown> {
  type: RelationTypeName
  siblingIdx?: number
  curveFlip?: boolean
  curveFlipPinned?: boolean
}
