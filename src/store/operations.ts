import type { GraphSnapshot, NessoOperation, NessoState, Preferences, RendererDefinition, SavedView, Selection, ThemeDefinition, WorkspaceState } from '@nesso/plugin'
import { relationKey, SchemaError, validateGraph, type Graph, type RelationType } from '@nesso/schema'
import { fail, parsePreferences, parseWorkspace } from './settings.ts'
import { sectionIds } from './types.ts'

export const checkGraph = (graph: GraphSnapshot): void => {
  const issues = validateGraph(graph)
  if (graph.concepts.length === 0) issues.push({ path: 'concepts', message: 'Graph must keep at least one concept' })
  if (issues.length > 0) throw new SchemaError(issues)
}

const selectionExists = (graph: GraphSnapshot, selected: Selection): boolean =>
  !selected || (selected.kind === 'concept'
    ? graph.concepts.some((concept) => concept.id === selected.id)
    : graph.relations.some((relation) => relationKey(relation) === selected.id))

export const materialize = (graph: GraphSnapshot, workspace: WorkspaceState): GraphSnapshot => {
  if (workspace.activeViewId === null) return graph
  const ids = new Set(workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.conceptIds ?? [])
  return {
    concepts: graph.concepts.filter((concept) => ids.has(concept.id)),
    relations: graph.relations.filter((relation) => ids.has(relation.source) && ids.has(relation.target)),
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
  left.activeVocabId === right.activeVocabId && left.activeRendererId === right.activeRendererId && left.activeThemeId === right.activeThemeId
  && left.panels.explorerWidth === right.panels.explorerWidth && left.panels.inspectorWidth === right.panels.inspectorWidth
  && sameItems(left.collapsedSections ?? [], right.collapsedSections ?? [], (a, b) => a === b)

export const applyStateOperations = (state: NessoState, operations: readonly NessoOperation[], registry: {
  readonly renderers: ReadonlyMap<string, RendererDefinition>
  readonly themes: ReadonlyMap<string, ThemeDefinition>
}): NessoState => {
  if (operations.length === 0) return state
  let graph = state.graph
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

  const withType = (type: Readonly<RelationType>): GraphSnapshot['relationTypes'] =>
    graph.relationTypes.some((item) => item.id === type.id) ? graph.relationTypes : [...graph.relationTypes, { ...type }]

  const updateConcept = (
    id: string,
    update: (concept: GraphSnapshot['concepts'][number]) => GraphSnapshot['concepts'][number],
  ): void => {
    const concept = graph.concepts.find((item) => item.id === id)
    if (!concept) return
    const next = update(concept)
    if (next !== concept) graph = { ...graph, concepts: graph.concepts.map((item) => item === concept ? next : item) }
  }

  const setPositions = (updates: Extract<NessoOperation, { kind: 'concept.positions' }>['updates']): void => {
    if (updates.length === 0) return
    const positions = new Map(updates.map(({ id, position }) => [id, position]))
    let changed = false
    const concepts = graph.concepts.map((concept) => {
      const position = positions.get(concept.id)
      if (!position || (position.x === concept.position.x && position.y === concept.position.y)) return concept
      changed = true
      return { ...concept, position: { x: position.x, y: position.y } }
    })
    if (changed) graph = { ...graph, concepts }
  }

  const retypeRelation = (id: string, type: Readonly<RelationType>): void => {
    const relation = graph.relations.find((item) => relationKey(item) === id)
    if (!relation || relation.predicate === type.id) return
    const triple = relationKey({ ...relation, predicate: type.id })
    if (graph.relations.some((item) => relationKey(item) === triple)) return
    graph = {
      ...graph,
      relationTypes: withType(type),
      relations: graph.relations.map((item) => item === relation ? { ...item, predicate: type.id } : item),
    }
    selected = { kind: 'relation', id: triple }
  }

  const updateView = (id: string, update: (view: SavedView) => SavedView): void => {
    const view = workspace.savedViews.find((view) => view.id === id) ?? fail('view.id', 'Unknown view')
    const next = update(view)
    if (next !== view) workspace = { ...workspace, savedViews: workspace.savedViews.map((item) => item === view ? next : item) }
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
        const source = selected?.kind === 'concept'
          ? graph.concepts.find((concept) => concept.id === selected?.id)
          : undefined
        const vocab = source ? activeVocab() : null
        const type = vocab?.relationTypes.find((item) => item.id === vocab.defaultTypeId)
        graph = {
          ...graph,
          relationTypes: type ? withType(type) : graph.relationTypes,
          concepts: [...graph.concepts, {
            id: operation.id,
            label: `Concept ${graph.concepts.length + 1}`,
            position: operation.position ? { x: operation.position.x, y: operation.position.y } : {
              x: (source?.position.x ?? 0) + 160,
              y: (source?.position.y ?? 0) + 100,
            },
          }],
          relations: source && vocab ? [...graph.relations, { source: source.id, predicate: vocab.defaultTypeId, target: operation.id }] : graph.relations,
        }
        selected = { kind: 'concept', id: operation.id }
        if (workspace.activeViewId !== null) updateView(workspace.activeViewId, (view) =>
          view.conceptIds.includes(operation.id) ? view : { ...view, conceptIds: [...view.conceptIds, operation.id] })
        break
      }
      case 'concept.remove': {
        if (!graph.concepts.some((concept) => concept.id === operation.id)) break
        const relations = graph.relations.filter((relation) => relation.source !== operation.id && relation.target !== operation.id)
        graph = {
          ...graph,
          concepts: graph.concepts.filter((concept) => concept.id !== operation.id),
          relations: relations.length === graph.relations.length ? graph.relations : relations,
        }
        const savedViews = workspace.savedViews.map((view) => view.conceptIds.includes(operation.id)
          ? { ...view, conceptIds: view.conceptIds.filter((id) => id !== operation.id) } : view)
        if (savedViews.some((view, index) => view !== workspace.savedViews[index])) workspace = { ...workspace, savedViews }
        break
      }
      case 'relation.connect': {
        if (!operation.source || !operation.target || operation.source === operation.target) break
        const vocab = activeVocab()
        const relation = { source: operation.source, predicate: vocab.defaultTypeId, target: operation.target }
        const key = relationKey(relation)
        if (graph.relations.some((item) => relationKey(item) === key)) break
        const type = vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? { id: vocab.defaultTypeId, label: '' }
        graph = { ...graph, relationTypes: withType(type), relations: [...graph.relations, relation] }
        selected = { kind: 'relation', id: key }
        break
      }
      case 'relation.type': {
        const type = graph.relationTypes.find((item) => item.id === operation.typeId)
          ?? activeVocab().relationTypes.find((item) => item.id === operation.typeId)
        if (!type) throw new SchemaError([{ path: 'relationTypeId', message: `Unknown relation type: ${operation.typeId}` }])
        retypeRelation(operation.id, type)
        break
      }
      case 'relation.type.create': {
        const label = operation.label.trim()
        if (!label) throw new SchemaError([{ path: 'label', message: 'Relation type label must not be empty' }])
        if (graph.relationTypes.some((type) => type.id === operation.typeId)) {
          throw new SchemaError([{ path: 'relationTypeId', message: `Duplicate relation type IRI: ${operation.typeId}` }])
        }
        retypeRelation(operation.id, { id: operation.typeId, label })
        break
      }
      case 'relation.remove': {
        const relations = graph.relations.filter((relation) => relationKey(relation) !== operation.id)
        if (relations.length !== graph.relations.length) graph = { ...graph, relations }
        break
      }
      case 'document.reset':
        graph = newGraph(operation.id)
        workspace = newWorkspace()
        selected = null
        explicitSelection = selected
        reset = true
        break
      case 'selection.set':
        selected = operation.value && selectionExists(graph, operation.value) ? { ...operation.value } : null
        explicitSelection = selected
        break
      case 'view.activate':
        if (operation.id !== null && !workspace.savedViews.some((view) => view.id === operation.id)) fail('workspace.activeViewId', 'Unknown view')
        if (workspace.activeViewId === operation.id) break
        workspace = { ...workspace, activeViewId: operation.id }
        if (!selectionExists(materialize(graph, workspace), selected)) selected = null
        explicitSelection = selected
        break
      case 'view.create':
        workspace = { ...workspace, activeViewId: operation.id, savedViews: [...workspace.savedViews, {
          id: operation.id, name: viewName(operation.name), conceptIds: [...new Set(operation.conceptIds)], pinned: false,
        }] }
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
        if (!graph.concepts.some((concept) => concept.id === operation.conceptId)) fail('view.conceptId', 'Unknown concept')
        if (typeof operation.included !== 'boolean') fail('view.included', 'Expected a boolean')
        updateView(operation.viewId, (view) => view.conceptIds.includes(operation.conceptId) === operation.included ? view : {
          ...view, conceptIds: operation.included ? [...view.conceptIds, operation.conceptId] : view.conceptIds.filter((id) => id !== operation.conceptId),
        })
        break
      case 'view.remove':
        if (!workspace.savedViews.some((view) => view.id === operation.id)) fail('view.id', 'Unknown view')
        workspace = { ...workspace, activeViewId: workspace.activeViewId === operation.id ? null : workspace.activeViewId,
          savedViews: workspace.savedViews.filter((view) => view.id !== operation.id) }
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

  if (sameGraph(graph, state.graph)) {
    graph = state.graph
    selected = explicitSelection
  }
  if (graph !== state.graph) checkGraph(graph)
  if (!reset && graph.relations !== state.graph.relations) {
    const used = new Set(graph.relations.map((relation) => relation.predicate))
    const vocabularyTypes = new Set(state.vocabs.flatMap((vocab) => vocab.relationTypes.map((type) => type.id)))
    const removed = new Set(state.graph.relations.map((relation) => relation.predicate)
      .filter((id) => !used.has(id) && !vocabularyTypes.has(id)))
    const relationTypes = graph.relationTypes.filter((type) => !removed.has(type.id))
    if (relationTypes.length !== graph.relationTypes.length) graph = { ...graph, relationTypes }
  }
  if (workspace !== state.workspace) {
    parseWorkspace(workspace)
    const ids = new Set(graph.concepts.map((concept) => concept.id))
    if (workspace.savedViews.some((view) => view.conceptIds.some((id) => !ids.has(id)))) fail('view.conceptIds', 'Unknown concept')
    if (sameWorkspace(workspace, state.workspace)) workspace = state.workspace
  }
  if (preferences !== state.preferences) {
    parsePreferences(preferences)
    if (samePreferences(preferences, state.preferences)) preferences = state.preferences
  }
  if (!selectionExists(graph, selected)) selected = null
  if (selected?.kind === state.selected?.kind && selected?.id === state.selected?.id) selected = state.selected
  if (graph === state.graph && workspace === state.workspace && preferences === state.preferences && selected === state.selected) return state
  const previousIds = state.workspace.savedViews.find((view) => view.id === state.workspace.activeViewId)?.conceptIds ?? []
  const visibleIds = workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.conceptIds ?? []
  const viewGraph = graph === state.graph && workspace.activeViewId === state.workspace.activeViewId && sameItems(visibleIds, previousIds, (a, b) => a === b)
    ? state.viewGraph : materialize(graph, workspace)
  return { ...state, graph, workspace, preferences, selected, viewGraph }
}
