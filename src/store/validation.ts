import type { GraphSnapshot, WorkspaceState } from '@nesso-how/core'
import {
  conceptSchema,
  graphSchema,
  relationKey,
  relationTypeSchema,
  SchemaError,
  validateGraph,
  type Relation,
  type SchemaIssue,
} from '@nesso-how/schema'
import { indexOf, type Change, type DocumentDelta } from './delta.ts'
import {
  fail,
  maxConceptLabelLength,
  maxRelationLabelLength,
  parseWorkspace,
  validReferences,
  workspaceFieldsSchema,
} from './settings.ts'

export type GraphChanges = Pick<DocumentDelta, 'concepts' | 'relations' | 'relationTypes'>

const relationSchema = graphSchema.shape.relations.element
const byId = ({ id }: { readonly id: string }) => id

export const relationLabelIssues = (types: readonly { label: string }[]): SchemaIssue[] =>
  types.flatMap((type, index) =>
    type.label.length > maxRelationLabelLength
      ? [
          {
            path: `relationTypes[${index}].label`,
            message: `Relation label must not exceed ${maxRelationLabelLength} characters`,
          },
        ]
      : [],
  )

export const checkGraph = (graph: GraphSnapshot): void => {
  const issues = validateGraph(graph)
  if (graph.concepts.length === 0)
    issues.push({ path: 'concepts', message: 'Graph must keep at least one concept' })
  graph.concepts.forEach((concept, index) => {
    if (concept.label.length > maxConceptLabelLength) {
      issues.push({
        path: `concepts[${index}].label`,
        message: `Concept label must not exceed ${maxConceptLabelLength} characters`,
      })
    }
  })
  issues.push(...relationLabelIssues(graph.relationTypes))
  if (issues.length > 0) throw new SchemaError(issues)
}

export const checkWorkspace = (graph: GraphSnapshot, workspace: WorkspaceState): void => {
  const concepts = new Set(graph.concepts.map(({ id }) => id))
  const relations = new Set(graph.relations.map(relationKey))
  for (const [index, map] of workspace.maps.entries()) {
    const members = new Set(map.members.map(({ id }) => id))
    if ([...members].some((id) => !concepts.has(id)))
      fail(`workspace.maps[${index}].members`, 'Unknown concept')
    const bends = (map.relationBends ?? []).map(relationKey)
    if (
      new Set(bends).size < bends.length ||
      map.relationBends?.some(
        (bend) =>
          !relations.has(relationKey(bend)) ||
          !members.has(bend.source) ||
          !members.has(bend.target),
      )
    )
      fail(`workspace.maps[${index}].relationBends`, 'Duplicate or invalid relation bend')
  }
}

const unique = <T>(items: readonly T[], key: (item: T) => string): boolean =>
  indexOf(items, key).size === items.length

const added = <T>(changes: readonly Change<T>[], valid: (value: T) => boolean): boolean =>
  changes.every(({ after }) => !after || valid(after.value))

const validGraphChanges = (graph: GraphSnapshot, changes: GraphChanges): boolean => {
  const concepts = indexOf(graph.concepts, byId)
  const types = indexOf(graph.relationTypes, byId)
  const known = (relation: Relation) =>
    concepts.has(relation.source) && concepts.has(relation.target) && types.has(relation.predicate)
  const removed = [...changes.concepts, ...changes.relationTypes].some(({ after }) => !after)
  return (
    graph.concepts.length > 0 &&
    concepts.size === graph.concepts.length &&
    types.size === graph.relationTypes.length &&
    (changes.relations.length === 0 || unique(graph.relations, relationKey)) &&
    added(
      changes.concepts,
      (concept) =>
        conceptSchema.safeParse(concept).success &&
        concept.label.length <= maxConceptLabelLength &&
        !types.has(concept.id),
    ) &&
    added(
      changes.relationTypes,
      (type) =>
        relationTypeSchema.safeParse(type).success &&
        type.label.length <= maxRelationLabelLength &&
        !concepts.has(type.id),
    ) &&
    added(
      changes.relations,
      (relation) => relationSchema.safeParse(relation).success && known(relation),
    ) &&
    (!removed || graph.relations.every(known))
  )
}

export const checkGraphChanges = (graph: GraphSnapshot, changes?: GraphChanges): void => {
  if (!changes || !validGraphChanges(graph, changes)) checkGraph(graph)
}

const validWorkspaceChanges = (
  graph: GraphSnapshot,
  workspace: WorkspaceState,
  previous: WorkspaceState,
  changes: GraphChanges,
): boolean => {
  const before = indexOf(previous.maps, byId)
  const changed = new Set(
    workspace.maps.filter((map) => previous.maps[before.get(map.id) ?? -1] !== map),
  )
  const fields = {
    ...workspace,
    maps: [...changed],
    viewports: workspace.viewports === previous.viewports ? {} : workspace.viewports,
  }
  if (!workspaceFieldsSchema.safeParse(fields).success || !validReferences(workspace)) return false
  const concepts = indexOf(graph.concepts, byId)
  const removedConcepts = changes.concepts.filter(({ after }) => !after)
  const removedRelations = new Set(changes.relations.filter(({ after }) => !after).map(byId))
  return workspace.maps.every((map) => {
    const members = () => indexOf(map.members, byId)
    const bends = map.relationBends ?? []
    if (!changed.has(map))
      return (
        !removedConcepts.some(({ id }) => members().has(id)) &&
        !bends.some((bend) => removedRelations.has(relationKey(bend)))
      )
    return (
      map.members.every(({ id }) => concepts.has(id)) &&
      unique(bends, relationKey) &&
      bends.every(
        (bend) =>
          indexOf(graph.relations, relationKey).has(relationKey(bend)) &&
          members().has(bend.source) &&
          members().has(bend.target),
      )
    )
  })
}

export const checkWorkspaceChanges = (
  graph: GraphSnapshot,
  workspace: WorkspaceState,
  previous: WorkspaceState,
  changes?: GraphChanges,
): void => {
  if (changes && validWorkspaceChanges(graph, workspace, previous, changes)) return
  parseWorkspace(workspace)
  checkWorkspace(graph, workspace)
}
