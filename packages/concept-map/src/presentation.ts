import type { PresentedGraph } from './types.ts'
import type { RelationGroup } from './groups.ts'

export type ConceptMapPresentation = {
  graph: PresentedGraph
  viewId: string | null
  groups: readonly RelationGroup[]
}
