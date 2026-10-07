import type { GraphSnapshot, NessoOperation, NessoState, Preferences, RendererDefinition, SavedView, Selection, ThemeDefinition, WorkspaceState } from '@nesso/plugin'
import { relationKey, SchemaError, validateGraph, type Graph, type Relation, type RelationType } from '@nesso/schema'
import { isLocale } from '@nesso/i18n'
import { fail, maxConceptLabelLength, maxRelationLabelLength, parsePreferences, parseWorkspace } from './settings.ts'
import { sectionIds } from './types.ts'
import { ListEdit, sameConcept, sameIds, sameType, sameView, viewChanges } from './delta.ts'

export const conceptPlacementOffset = Object.freeze({ x: 160, y: 100 })

export const checkGraph = (graph: GraphSnapshot): void => {
  const issues = validateGraph(graph)
  if (graph.concepts.length === 0) issues.push({ path: 'concepts', message: 'Graph must keep at least one concept' })
  graph.concepts.forEach((concept, index) => {
    if (concept.label.length > maxConceptLabelLength) {
      issues.push({ path: `concepts[${index}].label`, message: `Concept label must not exceed ${maxConceptLabelLength} characters` })
    }
  })
  graph.relationTypes.forEach((type, index) => {
    if (type.label.length > maxRelationLabelLength) {
      issues.push({ path: `relationTypes[${index}].label`, message: `Relation label must not exceed ${maxRelationLabelLength} characters` })
    }
  })
  if (issues.length > 0) throw new SchemaError(issues)
}

export const reconcileSelection = (graph: GraphSnapshot, selected: Selection): Selection => {
  if (selected.length === 0) return selected
  const available = {
    concept: new Set(graph.concepts.map((concept) => concept.id)),
    relation: new Set(graph.relations.map(relationKey)),
  }
  const next = selected.filter(({ kind, id }) => available[kind].delete(id))
  return next.length === selected.length ? selected : next
}

export const materialize = (graph: GraphSnapshot, workspace: WorkspaceState, previous?: NessoState): GraphSnapshot => {
  if (workspace.activeViewId === null) return graph
  const visibleIds = workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.conceptIds ?? []
  const previousIds = previous?.workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.conceptIds ?? []
  const sameScope = previous?.workspace.activeViewId === workspace.activeViewId && sameIds(visibleIds, previousIds)
  if (sameScope && graph === previous.graph) return previous.viewGraph
  const ids = new Set(visibleIds)
  return {
    concepts: sameScope && graph.concepts === previous.graph.concepts ? previous.viewGraph.concepts : graph.concepts.filter((concept) => ids.has(concept.id)),
    relations: sameScope && graph.relations === previous.graph.relations ? previous.viewGraph.relations : graph.relations.filter((relation) => ids.has(relation.source) && ids.has(relation.target)),
    relationTypes: graph.relationTypes,
  }
}

export const newGraph = (id: string): Graph => ({
  concepts: [{ id, label: 'Concept 1', position: { x: 0, y: 0 } }],
  relationTypes: [],
  relations: [],
})

export const newWorkspace = (): WorkspaceState => ({ activeViewId: null, savedViews: [], viewports: {} })

const sameItems = <T>(left: readonly T[], right: readonly T[], equal: (left: T, right: T) => boolean): boolean =>
  left === right || (left.length === right.length && left.every((item, index) => item === right[index] || equal(item, right[index])))

const sameGraph = (left: GraphSnapshot, right: GraphSnapshot): boolean =>
  sameItems(left.concepts, right.concepts, (a, b) =>
    a.id === b.id && a.label === b.label && a.position.x === b.position.x && a.position.y === b.position.y)
  && sameItems(left.relations, right.relations, (a, b) => relationKey(a) === relationKey(b))
  && sameItems(left.relationTypes, right.relationTypes, (a, b) => a.id === b.id && a.label === b.label)

const sameWorkspace = (left: WorkspaceState, right: WorkspaceState): boolean =>
  left.activeViewId === right.activeViewId
  && sameItems(left.savedViews, right.savedViews, (a, b) =>
    a.id === b.id && a.name === b.name && a.pinned === b.pinned && sameItems(a.conceptIds, b.conceptIds, (a, b) => a === b))
  && Object.keys(left.viewports).length === Object.keys(right.viewports).length
  && Object.entries(left.viewports).every(([id, a]) => {
    const b = right.viewports[id]
    return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.zoom === b.zoom)
  })

const samePreferences = (left: Preferences, right: Preferences): boolean =>
  left.locale === right.locale && left.activeVocabId === right.activeVocabId && left.activeRendererId === right.activeRendererId && left.activeThemeId === right.activeThemeId
  && left.panels.explorerWidth === right.panels.explorerWidth && left.panels.inspectorWidth === right.panels.inspectorWidth
  && sameItems(left.collapsedSections ?? [], right.collapsedSections ?? [], (a, b) => a === b)

export const applyStateOperations = (state: NessoState, operations: readonly NessoOperation[], registry: {
  readonly renderers: ReadonlyMap<string, RendererDefinition>
  readonly themes: ReadonlyMap<string, ThemeDefinition>
}) => {
  let concepts = new ListEdit(state.graph.concepts, (item) => item.id, sameConcept)
  let relations = new ListEdit(state.graph.relations, relationKey, (a, b) => relationKey(a) === relationKey(b))
  let types = new ListEdit(state.graph.relationTypes, (item) => item.id, sameType)
  let views = new ListEdit(state.workspace.savedViews, (item) => item.id, sameView)
  const graph = (): GraphSnapshot => ({ concepts: concepts.items, relations: relations.items, relationTypes: types.items })
  let workspace = state.workspace
  let preferences = state.preferences
  let selected = state.selected
  let explicitSelection = state.selected
  let reset = false

  const activeVocab = () => {
    const vocab = state.vocabs.find((item) => item.id === preferences.activeVocabId)
    if (!vocab) throw new SchemaError([{ path: 'activeVocabId', message: 'No active vocabulary' }])
    return vocab
  }

  const withType = (type: Readonly<RelationType>): void => {
    if (!types.get(type.id)) types.add({ ...type })
  }

  const updateConcept = (
    id: string,
    update: (concept: GraphSnapshot['concepts'][number]) => GraphSnapshot['concepts'][number],
  ): void => {
    const concept = concepts.get(id)
    if (!concept) return
    const next = update(concept)
    concepts.set(id, next)
  }

  const setPositions = (updates: Extract<NessoOperation, { kind: 'concept.positions' }>['updates']): void => {
    if (updates.length === 0) return
    for (const { id, position } of updates) updateConcept(id, (concept) =>
      position.x === concept.position.x && position.y === concept.position.y ? concept : { ...concept, position: { x: position.x, y: position.y } })
  }

  const updateRelation = (id: string, updates: Partial<Relation>, type?: Readonly<RelationType>): void => {
    const relation = relations.get(id)
    if (!relation) return
    const next = { ...relation, ...updates }
    const triple = relationKey(next)
    if (triple === id) return
    if (relations.get(triple)) return
    if (type) withType(type)
    relations.set(id, next)
    selected = selected.some((item) => item.kind === 'relation' && item.id === id)
      ? selected.map((item) => item.kind === 'relation' && item.id === id ? { kind: 'relation', id: triple } : item)
      : [{ kind: 'relation', id: triple }]
  }

  const updateView = (id: string, update: (view: SavedView) => SavedView): void => {
    const view = views.get(id) ?? fail('view.id', 'Unknown view')
    const next = update(view)
    views.set(id, next)
    if (views.items !== workspace.savedViews) workspace = { ...workspace, savedViews: views.items }
  }

  const viewName = (name: string): string => {
    if (typeof name !== 'string') fail('view.name', 'Expected a string')
    return name.trim()
  }

  for (const operation of operations) {
    switch (operation.kind) {
      case 'concept.label':
        updateConcept(operation.id, (concept) => concept.label === operation.value ? concept : { ...concept, label: operation.value })
        break
      case 'concept.position':
        setPositions([{ id: operation.id, position: operation.value }])
        break
      case 'concept.positions':
        setPositions(operation.updates)
        break
      case 'concept.add': {
        const current = reconcileSelection(graph(), selected)
        const source = current.length === 1 && current[0].kind === 'concept'
          ? concepts.get(current[0].id)
          : undefined
        const vocab = source ? activeVocab() : null
        const type = vocab?.relationTypes.find((item) => item.id === vocab.defaultTypeId)
        if (type) withType(type)
        concepts.add({
          id: operation.id,
          label: `Concept ${concepts.items.length + 1}`,
          position: operation.position ? { x: operation.position.x, y: operation.position.y } : {
            x: (source?.position.x ?? 0) + conceptPlacementOffset.x,
            y: (source?.position.y ?? 0) + conceptPlacementOffset.y,
          },
        })
        if (source && vocab) relations.add({ source: source.id, predicate: vocab.defaultTypeId, target: operation.id })
        selected = [{ kind: 'concept', id: operation.id }]
        if (workspace.activeViewId !== null) updateView(workspace.activeViewId, (view) =>
          view.conceptIds.includes(operation.id) ? view : { ...view, conceptIds: [...view.conceptIds, operation.id] })
        break
      }
      case 'concept.remove': {
        if (!concepts.get(operation.id)) break
        relations.removeWhere((relation) => relation.source === operation.id || relation.target === operation.id)
        concepts.removeWhere((concept) => concept.id === operation.id)
        for (const view of views.items) if (view.conceptIds.includes(operation.id)) updateView(view.id, (view) =>
          ({ ...view, conceptIds: view.conceptIds.filter((id) => id !== operation.id) }))
        break
      }
      case 'relation.connect': {
        if (!operation.source || !operation.target || operation.source === operation.target) break
        const vocab = activeVocab()
        const relation = { source: operation.source, predicate: vocab.defaultTypeId, target: operation.target }
        const key = relationKey(relation)
        if (relations.get(key)) break
        const type = vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? { id: vocab.defaultTypeId, label: '' }
        withType(type)
        relations.add(relation)
        selected = [{ kind: 'relation', id: key }]
        break
      }
      case 'relation.type': {
        const type = types.get(operation.typeId)
          ?? activeVocab().relationTypes.find((item) => item.id === operation.typeId)
        if (!type) throw new SchemaError([{ path: 'relationTypeId', message: `Unknown relation type: ${operation.typeId}` }])
        updateRelation(operation.id, { predicate: type.id }, type)
        break
      }
      case 'relation.type.create': {
        const label = operation.label.trim()
        if (!label) throw new SchemaError([{ path: 'label', message: 'Relation type label must not be empty' }])
        if (types.get(operation.typeId)) {
          throw new SchemaError([{ path: 'relationTypeId', message: `Duplicate relation type IRI: ${operation.typeId}` }])
        }
        updateRelation(operation.id, { predicate: operation.typeId }, { id: operation.typeId, label })
        break
      }
      case 'relation.reconnect':
        if (operation.source && operation.target && operation.source !== operation.target) {
          updateRelation(operation.id, { source: operation.source, target: operation.target })
        }
        break
      case 'relation.remove': {
        relations.removeWhere((relation) => relationKey(relation) === operation.id)
        break
      }
      case 'document.reset':
        concepts = new ListEdit(newGraph(operation.id).concepts, (item) => item.id, sameConcept)
        relations = new ListEdit([], relationKey, (a, b) => relationKey(a) === relationKey(b))
        types = new ListEdit([], (item: Readonly<RelationType>) => item.id, sameType)
        views = new ListEdit([], (item: SavedView) => item.id, sameView)
        workspace = newWorkspace()
        selected = []
        explicitSelection = selected
        reset = true
        break
      case 'selection.set':
        selected = reconcileSelection(graph(), operation.value.map((item) => ({ ...item })))
        explicitSelection = selected
        break
      case 'view.activate':
        if (operation.id !== null && !workspace.savedViews.some((view) => view.id === operation.id)) fail('workspace.activeViewId', 'Unknown view')
        if (workspace.activeViewId === operation.id) break
        workspace = { ...workspace, activeViewId: operation.id }
        selected = reconcileSelection(materialize(graph(), workspace), selected)
        explicitSelection = selected
        break
      case 'view.create':
        views.add({
          id: operation.id, name: viewName(operation.name), conceptIds: [...new Set(operation.conceptIds)], pinned: false,
        })
        workspace = { ...workspace, activeViewId: operation.id, savedViews: views.items }
        break
      case 'view.rename':
        updateView(operation.id, (view) => {
          const name = viewName(operation.name)
          return view.name === name ? view : { ...view, name }
        })
        break
      case 'view.pin':
        updateView(operation.id, (view) => view.pinned === operation.pinned ? view : { ...view, pinned: operation.pinned })
        break
      case 'view.membership':
        if (!concepts.get(operation.conceptId)) fail('view.conceptId', 'Unknown concept')
        if (typeof operation.included !== 'boolean') fail('view.included', 'Expected a boolean')
        updateView(operation.viewId, (view) => view.conceptIds.includes(operation.conceptId) === operation.included ? view : {
          ...view, conceptIds: operation.included ? [...view.conceptIds, operation.conceptId] : view.conceptIds.filter((id) => id !== operation.conceptId),
        })
        break
      case 'view.remove':
        if (!workspace.savedViews.some((view) => view.id === operation.id)) fail('view.id', 'Unknown view')
        views.removeWhere((view) => view.id === operation.id)
        workspace = { ...workspace, activeViewId: workspace.activeViewId === operation.id ? null : workspace.activeViewId, savedViews: views.items }
        break
      case 'viewport.set':
        if (!registry.renderers.has(operation.rendererId)) fail('rendererId', `Unknown renderer: ${operation.rendererId}`)
        workspace = { ...workspace, viewports: { ...workspace.viewports, [operation.rendererId]: { ...operation.value } } }
        break
      case 'preferences.vocab':
        if (!state.vocabs.some((vocab) => vocab.id === operation.id)) {
          throw new SchemaError([{ path: 'activeVocabId', message: `Unknown vocabulary: ${operation.id}` }])
        }
        preferences = { ...preferences, activeVocabId: operation.id }
        break
      case 'preferences.renderer':
        if (!registry.renderers.has(operation.id)) {
          throw new SchemaError([{ path: 'activeRendererId', message: `Unknown renderer: ${operation.id}` }])
        }
        preferences = { ...preferences, activeRendererId: operation.id }
        break
      case 'preferences.theme':
        if (!registry.themes.has(operation.id)) fail('preferences.activeThemeId', `Unknown theme: ${operation.id}`)
        preferences = { ...preferences, activeThemeId: operation.id }
        break
      case 'preferences.locale':
        if (!isLocale(operation.value)) fail('preferences.locale', 'Unsupported locale')
        preferences = { ...preferences, locale: operation.value }
        break
      case 'preferences.panels':
        preferences = { ...preferences, panels: { ...operation.value } }
        break
      case 'preferences.section': {
        if (!sectionIds.includes(operation.id)) fail('preferences.collapsedSections', 'Unknown section')
        if (typeof operation.open !== 'boolean') fail('section.open', 'Expected a boolean')
        const collapsed = preferences.collapsedSections ?? []
        if (!collapsed.includes(operation.id) === operation.open) break
        preferences = { ...preferences, collapsedSections: operation.open ? collapsed.filter((id) => id !== operation.id) : [...collapsed, operation.id] }
        break
      }
      default:
        throw new SchemaError([{ path: 'operations', message: 'Unknown operation' }])
    }
  }

  const conceptEdit = concepts.finish()
  const relationEdit = relations.finish()
  if (!reset && relationEdit.items !== state.graph.relations) {
    const used = new Set(relationEdit.items.map((relation) => relation.predicate))
    const vocabularyTypes = new Set(state.vocabs.flatMap((vocab) => vocab.relationTypes.map((type) => type.id)))
    const removed = new Set(relationEdit.changes.flatMap((change) => change.before ? [change.before.value.predicate] : [])
      .filter((id) => !used.has(id) && !vocabularyTypes.has(id)))
    types.removeWhere((type) => removed.has(type.id))
  }
  const typeEdit = types.finish()
  const viewEdit = views.finish()
  let candidate: GraphSnapshot = { concepts: conceptEdit.items, relations: relationEdit.items, relationTypes: typeEdit.items }
  if (candidate.concepts === state.graph.concepts && candidate.relations === state.graph.relations && candidate.relationTypes === state.graph.relationTypes
    || (reset && sameGraph(candidate, state.graph))) {
    candidate = state.graph
    selected = explicitSelection
  }
  if (candidate !== state.graph) checkGraph(candidate)
  if (viewEdit.items !== workspace.savedViews) workspace = { ...workspace, savedViews: viewEdit.items }
  if (workspace !== state.workspace) {
    parseWorkspace(workspace)
    if (viewEdit.changes.some((change) => change.after?.value.conceptIds.some((id) => !concepts.get(id)))) fail('view.conceptIds', 'Unknown concept')
    if (sameWorkspace(workspace, state.workspace)) workspace = state.workspace
  }
  if (preferences !== state.preferences) {
    parsePreferences(preferences)
    if (samePreferences(preferences, state.preferences)) preferences = state.preferences
  }
  selected = reconcileSelection(candidate, selected)
  if (sameItems(selected, state.selected, (a, b) => a.kind === b.kind && a.id === b.id)) selected = state.selected
  const unchanged = candidate === state.graph && workspace === state.workspace && preferences === state.preferences && selected === state.selected
  const next = unchanged ? state : { ...state, graph: candidate, workspace, preferences, selected, viewGraph: materialize(candidate, workspace, state) }
  return { next, reset, delta: { concepts: conceptEdit.changes, relations: relationEdit.changes, relationTypes: typeEdit.changes, views: viewChanges(viewEdit.changes) } }
}
