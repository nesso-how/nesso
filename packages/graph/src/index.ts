// SPDX-License-Identifier: MIT
export { NessoGraph } from './NessoGraph.js'
export type { NessoGraphProps } from './NessoGraph.js'

export { ConceptNode } from './ConceptNode.js'
export { ConceptNodeBody } from './ConceptNodeBody.js'
export type { ConceptNodeBodyProps } from './ConceptNodeBody.js'
export { NessoEdge } from './NessoEdge.js'
export { useGraphDisplay, GraphDisplayContext } from './context.js'
export type { NessoGraphDisplayContext, CategoryColorMode } from './context.js'

// Shared canvas utilities — import from here to avoid duplication with the main app.
export { GlyphSVG } from './GlyphSVG.js'
export { ratingColor } from './ratingColor.js'
export {
  defaultCurveFlip,
  nodeCenterX,
  nodeCenterY,
  flowNodeCenterX,
  flowNodeCenterY,
  effectiveCurveFlip,
  rectExit,
  nessoArcPath,
} from './geometry.js'
