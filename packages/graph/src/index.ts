// SPDX-License-Identifier: MIT
export { NessoGraph } from './NessoGraph.js'
export type { NessoGraphProps } from './NessoGraph.js'

export { ConceptNode } from './ConceptNode.js'
export { ConceptNodeBody } from './ConceptNodeBody.js'
export type { ConceptNodeBodyProps } from './ConceptNodeBody.js'
export { NessoEdge } from './NessoEdge.js'
export { EdgeEndpointDot } from './EdgeEndpointDot.js'
export { isEdgeConnectedToNode, resolveEdgeVisual } from './edgeHighlight.js'
export type { EdgeVisual, EdgeVisualInput } from './edgeHighlight.js'
export { useGraphDisplay, GraphDisplayContext } from './context.js'
export type { NessoGraphDisplayContext, CategoryColorMode } from './context.js'

export type {
  CurveStyle,
  EdgeEncoding,
  GraphDisplaySettings,
  NessoEdgeData,
} from './display.js'
export type { ConnectionPreview, EndpointAttachment } from './geometry.js'
export { DEFAULT_GRAPH_DISPLAY } from './display.js'
export { documentToRenderGraph } from './documentToRenderGraph.js'

// Shared canvas utilities — import from here to avoid duplication with the main app.
export { ratingColor } from './ratingColor.js'
export {
  arcControlPoint,
  attachmentAt,
  clampCurveOffset,
  connectionPreview,
  edgeArcGeometry,
  pointFromBox,
  pointRelativeToBox,
  NODE_PAD,
  PREVIEW_DASHARRAY,
  quadraticPoint,
  CURVE_OFFSET_LIMIT,
  nodeCenterX,
  nodeCenterY,
  flowNodeCenterY,
  rectExit,
  nessoArcPath,
} from './geometry.js'
