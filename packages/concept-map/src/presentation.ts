import type { GraphSnapshot } from '@nesso-how/core'
import type { RelationGroup } from './groups.ts'

export type ConceptMapPresentation = {
  graph: GraphSnapshot
  viewId: string | null
  groups: readonly RelationGroup[]
}
