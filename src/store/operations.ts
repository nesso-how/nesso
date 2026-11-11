import type {
  GraphSnapshot,
  NessoOperation,
  NessoState,
  Preferences,
  SavedView,
  Selection,
  ViewGraphSnapshot,
  WorkspaceState,
} from '@nesso-how/core'
import type { ThemeDefinition } from '@nesso-how/plugin'
import {
  newIri,
  relationKey,
  SchemaError,
  validateGraph,
  type Graph,
  type Relation,
  type RelationType,
} from '@nesso-how/schema'
import { isLocale } from '@nesso-how/i18n'
import { aiChatLimits } from '@nesso-how/ai'
import {
  fail,
  maxConceptLabelLength,
  maxRelationLabelLength,
  parseConversation,
  parsePreferences,
  parseWorkspace,
} from './settings.ts'
import { sectionIds, type HostOperation, type HostState, type RendererDefinition } from './types.ts'
import { ListEdit, sameConcept, sameMembers, sameType, sameView, viewChanges } from './delta.ts'
import { applyPluginStorage } from './plugin-storage.ts'

export const conceptPlacementOffset = Object.freeze({ x: 160, y: 100 })

type Removal = Extract<HostOperation, { kind: 'concept.remove' | 'relation.remove' }>
type Member = SavedView['members'][number]
const isRemoval = (operation: HostOperation): operation is Removal =>
  operation.kind === 'concept.remove' || operation.kind === 'relation.remove'

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
  graph.relationTypes.forEach((type, index) => {
    if (type.label.length > maxRelationLabelLength) {
      issues.push({
        path: `relationTypes[${index}].label`,
        message: `Relation label must not exceed ${maxRelationLabelLength} characters`,
      })
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

export const materialize = (
  graph: GraphSnapshot,
  workspace: WorkspaceState,
  previous?: NessoState,
): ViewGraphSnapshot => {
  if (workspace.activeViewId === null) return graph
  const members =
    workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.members ?? []
  const previousMembers =
    previous && previous.workspace.activeViewId === workspace.activeViewId
      ? previous.workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.members
      : undefined
  const samePresentation = !!previousMembers && sameMembers(members, previousMembers)
  if (samePresentation && graph === previous!.graph) return previous!.viewGraph
  const scoped =
    !!previousMembers &&
    members.length === previousMembers.length &&
    members.every(({ id }, index) => id === previousMembers[index].id)
  const presentation = new Map(members.map((member) => [member.id, member]))
  const reusable = new Map(
    previousMembers ? previous!.viewGraph.concepts.map((concept) => [concept.id, concept]) : [],
  )
  const previousPresentation = new Map(previousMembers?.map((member) => [member.id, member]))
  const previousConcepts = new Map(previous?.graph.concepts.map((concept) => [concept.id, concept]))
  return {
    concepts:
      samePresentation && graph.concepts === previous!.graph.concepts
        ? previous!.viewGraph.concepts
        : graph.concepts.flatMap((concept) => {
            const member = presentation.get(concept.id)
            if (!member) return []
            const reused = reusable.get(concept.id)
            if (
              reused &&
              previousConcepts.get(concept.id) === concept &&
              previousPresentation.get(concept.id) === member
            )
              return [reused]
            const { id: _, ...view } = member
            return [{ ...concept, ...view }]
          }),
    relations:
      scoped && graph.relations === previous!.graph.relations
        ? previous!.viewGraph.relations
        : graph.relations.filter(
            (relation) => presentation.has(relation.source) && presentation.has(relation.target),
          ),
    relationTypes: graph.relationTypes,
  }
}

export const defaultViewName = 'View 1'

export const newDocument = (
  conceptId: string,
  viewId: string,
): { graph: Graph; workspace: WorkspaceState } => ({
  graph: { concepts: [{ id: conceptId, label: 'Concept 1' }], relationTypes: [], relations: [] },
  workspace: {
    activeViewId: viewId,
    savedViews: [
      {
        id: viewId,
        name: defaultViewName,
        members: [{ id: conceptId, position: { x: 0, y: 0 } }],
        pinned: false,
      },
    ],
    viewports: {},
  },
})

export const newWorkspace = (): WorkspaceState => ({
  activeViewId: null,
  savedViews: [],
  viewports: {},
})

const sameItems = <T>(
  left: readonly T[],
  right: readonly T[],
  equal: (left: T, right: T) => boolean,
): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every((item, index) => item === right[index] || equal(item, right[index])))

export const sameGraph = (left: GraphSnapshot, right: GraphSnapshot): boolean =>
  sameItems(left.concepts, right.concepts, sameConcept) &&
  sameItems(left.relations, right.relations, (a, b) => relationKey(a) === relationKey(b)) &&
  sameItems(left.relationTypes, right.relationTypes, (a, b) => a.id === b.id && a.label === b.label)

export const sameWorkspace = (left: WorkspaceState, right: WorkspaceState): boolean =>
  left.activeViewId === right.activeViewId &&
  sameItems(
    left.savedViews,
    right.savedViews,
    (a, b) =>
      a.id === b.id &&
      a.name === b.name &&
      a.pinned === b.pinned &&
      sameMembers(a.members, b.members),
  ) &&
  Object.keys(left.viewports).length === Object.keys(right.viewports).length &&
  Object.entries(left.viewports).every(([id, a]) => {
    const b = right.viewports[id]
    return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.zoom === b.zoom)
  })

export const samePreferences = (left: Preferences, right: Preferences): boolean =>
  left.locale === right.locale &&
  left.introSeen === right.introSeen &&
  (left.mcpEnabled ?? false) === (right.mcpEnabled ?? false) &&
  sameItems(
    left.disabledBundledActionPlugins ?? [],
    right.disabledBundledActionPlugins ?? [],
    (a, b) => a === b,
  ) &&
  sameItems(left.canvasTabOrder ?? [], right.canvasTabOrder ?? [], (a, b) => a === b) &&
  left.activeVocabId === right.activeVocabId &&
  left.activeRendererId === right.activeRendererId &&
  left.activeThemeId === right.activeThemeId &&
  left.panels.explorerWidth === right.panels.explorerWidth &&
  left.panels.inspectorWidth === right.panels.inspectorWidth &&
  (left.inspectorTab ?? 'details') === (right.inspectorTab ?? 'details') &&
  (left.relationGroups ?? true) === (right.relationGroups ?? true) &&
  sameItems(left.collapsedSections ?? [], right.collapsedSections ?? [], (a, b) => a === b)

export const applyStateOperations = (
  state: HostState,
  operations: readonly HostOperation[],
  registry: {
    readonly renderers: ReadonlyMap<string, RendererDefinition>
    readonly themes: ReadonlyMap<string, ThemeDefinition>
  },
) => {
  let concepts = new ListEdit(state.graph.concepts, (item) => item.id, sameConcept)
  let relations = new ListEdit(
    state.graph.relations,
    relationKey,
    (a, b) => relationKey(a) === relationKey(b),
  )
  let types = new ListEdit(state.graph.relationTypes, (item) => item.id, sameType)
  let views = new ListEdit(state.workspace.savedViews, (item) => item.id, sameView)
  let relationOrigins: Map<string, string> | undefined
  const origins = () =>
    (relationOrigins ??= new Map(
      state.graph.relations
        .filter((relation) => relations.get(relationKey(relation)) === relation)
        .map((relation) => [relationKey(relation), relationKey(relation)]),
    ))
  const graph = (): GraphSnapshot => ({
    concepts: concepts.items,
    relations: relations.items,
    relationTypes: types.items,
  })
  let workspace = state.workspace
  let preferences = state.preferences
  let conversation = state.conversation
  let conversationReplaced = false
  let documentId = state.documentId
  let pluginStorage = state.pluginStorage
  let selected = state.selected
  let explicitSelection = state.selected
  let reset = false

  const activeVocab = () => {
    const vocab = state.vocabs.find((item) => item.id === preferences.activeVocabId)
    if (!vocab) throw new SchemaError([{ path: 'activeVocabId', message: 'No active vocabulary' }])
    return vocab
  }

  const withType = (type: Readonly<RelationType>): void => {
    if (!types.get(type.id)) types.add({ id: type.id, label: type.label })
  }

  const updateConcept = (
    id: string,
    update: (concept: GraphSnapshot['concepts'][number]) => GraphSnapshot['concepts'][number],
  ): void => {
    const concept = concepts.get(id) ?? fail('concept.id', 'Unknown concept')
    const next = update(concept)
    concepts.set(id, next)
  }

  const updateMembers = (ids: ReadonlySet<string>, update: (member: Member) => Member): void => {
    for (const id of ids) if (!concepts.get(id)) fail('concept.id', 'Unknown concept')
    const viewId = workspace.activeViewId ?? fail('workspace.activeViewId', 'No active view')
    updateView(viewId, (view) => {
      let found = 0
      let changed = false
      const members = view.members.map((member) => {
        if (!ids.has(member.id)) return member
        found++
        const next = update(member)
        changed ||= next !== member
        return next
      })
      if (found !== ids.size) fail('view.members', 'Concept is not in the active view')
      return changed ? { ...view, members } : view
    })
  }

  const setPositions = (
    updates: Extract<NessoOperation, { kind: 'concept.positions' }>['updates'],
  ): void => {
    if (updates.length === 0) return
    const positions = new Map(updates.map(({ id, position }) => [id, position]))
    updateMembers(new Set(positions.keys()), (member) => {
      const position = positions.get(member.id)!
      return position.x === member.position.x && position.y === member.position.y
        ? member
        : { ...member, position: { x: position.x, y: position.y } }
    })
  }

  const placeMember = (
    id: string,
    members: readonly Member[],
    sources: readonly SavedView[] = [],
  ): Member => {
    for (const source of sources) {
      const copied = source.members.find((member) => member.id === id)
      if (copied) return copied
    }
    const placed = new Map(members.map((member) => [member.id, member]))
    const relation = relations.items.find(
      (relation) =>
        (relation.source === id && placed.has(relation.target)) ||
        (relation.target === id && placed.has(relation.source)),
    )
    const neighbor =
      relation && placed.get(relation.source === id ? relation.target : relation.source)
    return {
      id,
      position: neighbor
        ? {
            x: neighbor.position.x + conceptPlacementOffset.x,
            y: neighbor.position.y + conceptPlacementOffset.y,
          }
        : { x: 0, y: 0 },
    }
  }

  const updateRelation = (
    id: string,
    updates: Partial<Relation>,
    type?: Readonly<RelationType>,
  ): void => {
    const relation = relations.get(id) ?? fail('relation.id', 'Unknown relation')
    const next = { ...relation, ...updates }
    const triple = relationKey(next)
    if (triple === id) return
    if (relations.get(triple)) fail('relation.id', 'Duplicate relation')
    if (type) withType(type)
    const origin = origins().get(id)
    relationOrigins!.delete(id)
    if (origin !== undefined) relationOrigins!.set(triple, origin)
    relations.set(id, next)
    selected = selected.some((item) => item.kind === 'relation' && item.id === id)
      ? selected.map((item) =>
          item.kind === 'relation' && item.id === id ? { kind: 'relation', id: triple } : item,
        )
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

  const removedConcepts = new Set<string>()
  const removedRelations = new Set<string>()
  const remove = (removals: readonly Removal[]): void => {
    const conceptIds = new Set<string>()
    const relationIds = new Set<string>()
    for (const { kind, id } of removals) {
      if (kind === 'relation.remove') {
        if (relations.get(id)) {
          relationOrigins?.delete(id)
          relationIds.add(id)
        } else if (!removedRelations.has(id)) fail('relation.id', 'Unknown relation')
      } else if (concepts.get(id)) conceptIds.add(id)
      else if (!removedConcepts.has(id)) fail('concept.id', 'Unknown concept')
    }
    if (conceptIds.size + relationIds.size === 0) return
    relations.removeWhere((relation) => {
      const hit =
        conceptIds.has(relation.source) ||
        conceptIds.has(relation.target) ||
        (relationIds.size > 0 && relationIds.has(relationKey(relation)))
      if (hit) removedRelations.add(relationKey(relation))
      return hit
    })
    if (conceptIds.size === 0) return
    concepts.removeWhere((concept) => conceptIds.has(concept.id))
    for (const id of conceptIds) removedConcepts.add(id)
    for (const view of views.items)
      if (view.members.some(({ id }) => conceptIds.has(id)))
        updateView(view.id, (view) => ({
          ...view,
          members: view.members.filter(({ id }) => !conceptIds.has(id)),
        }))
  }

  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index]
    switch (operation.kind) {
      case 'plugin-storage.set':
      case 'plugin-storage.delete':
        if (operation.documentId !== documentId)
          fail('storage.documentId', 'Plugin storage belongs to another document')
        pluginStorage = applyPluginStorage(
          pluginStorage,
          operation,
          new Set(concepts.items.map(({ id }) => id)),
          new Set(views.items.map(({ id }) => id)),
        )
        break
      case 'conversation.messages':
        conversation = parseConversation({ version: 2, messages: operation.value })
        conversationReplaced = true
        break
      case 'conversation.append': {
        if (typeof operation.text !== 'string') fail('conversation.text', 'Expected a string')
        const position = conversation.messages.findIndex((message) => message.id === operation.id)
        if (position < 0) fail('conversation.id', 'Unknown message')
        if (operation.text === '') break
        const message = conversation.messages[position]
        const content = message.content + operation.text
        if (content.length > aiChatLimits.messageLength)
          fail(
            'conversation.content',
            `Message must not exceed ${aiChatLimits.messageLength} characters`,
          )
        const messages = [...conversation.messages]
        messages[position] = { ...message, content }
        conversation = { messages }
        break
      }
      case 'conversation.clear':
        conversation = { messages: [] }
        conversationReplaced = true
        break
      case 'concept.label':
        updateConcept(operation.id, (concept) =>
          concept.label === operation.value ? concept : { ...concept, label: operation.value },
        )
        break
      case 'concept.notes':
        updateConcept(operation.id, (concept) => {
          if ((concept.notes ?? '') === operation.value) return concept
          const { notes: _, ...next } = concept
          return operation.value === '' ? next : { ...next, notes: operation.value }
        })
        break
      case 'concept.color':
        updateMembers(new Set([operation.id]), (member) => {
          const value = operation.value.toLowerCase()
          if ((member.color ?? '') === value) return member
          const { color: _, ...next } = member
          return value === '' ? next : { ...next, color: value }
        })
        break
      case 'concept.bold':
      case 'concept.italic':
        updateMembers(new Set([operation.id]), (member) => {
          const key = operation.kind === 'concept.bold' ? 'bold' : 'italic'
          if ((member[key] ?? false) === operation.value) return member
          const next = { ...member }
          if (!operation.value) delete next[key]
          else next[key] = true
          return next
        })
        break
      case 'concept.position':
        setPositions([{ id: operation.id, position: operation.value }])
        break
      case 'concept.positions':
        setPositions(operation.updates)
        break
      case 'concept.add': {
        const current = reconcileSelection(graph(), selected)
        const source =
          current.length === 1 && current[0].kind === 'concept'
            ? concepts.get(current[0].id)
            : undefined
        const vocab = source ? activeVocab() : null
        const type = vocab?.relationTypes.find((item) => item.id === vocab.defaultTypeId)
        if (type) withType(type)
        concepts.add({ id: operation.id, label: `Concept ${concepts.items.length + 1}` })
        if (source && vocab) {
          const relation = {
            source: source.id,
            predicate: vocab.defaultTypeId,
            target: operation.id,
          }
          relationOrigins?.delete(relationKey(relation))
          relations.add(relation)
        }
        selected = [{ kind: 'concept', id: operation.id }]
        if (workspace.activeViewId !== null)
          updateView(workspace.activeViewId, (view) => {
            if (view.members.some(({ id }) => id === operation.id)) return view
            const origin = source && view.members.find(({ id }) => id === source.id)
            const position = operation.position ?? {
              x: (origin?.position.x ?? 0) + conceptPlacementOffset.x,
              y: (origin?.position.y ?? 0) + conceptPlacementOffset.y,
            }
            return {
              ...view,
              members: [
                ...view.members,
                {
                  id: operation.id,
                  position: { x: position.x, y: position.y },
                  ...(origin?.color === undefined ? {} : { color: origin.color }),
                },
              ],
            }
          })
        break
      }
      case 'concept.remove':
      case 'relation.remove': {
        let end = index + 1
        while (end < operations.length && isRemoval(operations[end])) end++
        remove(operations.slice(index, end).filter(isRemoval))
        index = end - 1
        break
      }
      case 'relation.connect': {
        if (!operation.source || !operation.target || operation.source === operation.target) break
        let type = operation.type
        if (!type) {
          const vocab = activeVocab()
          type = vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? {
            id: vocab.defaultTypeId,
            label: '',
          }
        }
        const relation = { source: operation.source, predicate: type.id, target: operation.target }
        const key = relationKey(relation)
        if (relations.get(key)) break
        withType(type)
        relationOrigins?.delete(key)
        relations.add(relation)
        selected = [{ kind: 'relation', id: key }]
        break
      }
      case 'relation.type': {
        const type =
          types.get(operation.typeId) ??
          activeVocab().relationTypes.find((item) => item.id === operation.typeId)
        if (!type)
          throw new SchemaError([
            { path: 'relationTypeId', message: `Unknown relation type: ${operation.typeId}` },
          ])
        updateRelation(operation.id, { predicate: type.id }, type)
        break
      }
      case 'relation.type.create': {
        const label = operation.label.trim()
        if (!label)
          throw new SchemaError([
            { path: 'label', message: 'Relation type label must not be empty' },
          ])
        if (types.get(operation.typeId)) {
          throw new SchemaError([
            { path: 'relationTypeId', message: `Duplicate relation type IRI: ${operation.typeId}` },
          ])
        }
        updateRelation(
          operation.id,
          { predicate: operation.typeId },
          { id: operation.typeId, label },
        )
        break
      }
      case 'relation.reconnect':
        if (!operation.source || !operation.target || operation.source === operation.target)
          fail('relation.target', 'Relation must connect two different concepts')
        updateRelation(operation.id, { source: operation.source, target: operation.target })
        break
      case 'document.reset': {
        const document = newDocument(operation.id, newIri())
        documentId = newIri()
        pluginStorage = []
        relationOrigins?.clear()
        concepts = new ListEdit(document.graph.concepts, (item) => item.id, sameConcept)
        relations = new ListEdit([], relationKey, (a, b) => relationKey(a) === relationKey(b))
        types = new ListEdit([], (item: Readonly<RelationType>) => item.id, sameType)
        views = new ListEdit(document.workspace.savedViews, (item: SavedView) => item.id, sameView)
        workspace = document.workspace
        conversation = { messages: [] }
        conversationReplaced = true
        selected = []
        explicitSelection = selected
        reset = true
        break
      }
      case 'selection.set':
        selected = reconcileSelection(
          graph(),
          operation.value.map((item) => ({ ...item })),
        )
        explicitSelection = selected
        break
      case 'view.activate':
        if (operation.id !== null && !workspace.savedViews.some((view) => view.id === operation.id))
          fail('workspace.activeViewId', 'Unknown view')
        if (workspace.activeViewId === operation.id) break
        workspace = { ...workspace, activeViewId: operation.id }
        selected = reconcileSelection(materialize(graph(), workspace), selected)
        explicitSelection = selected
        break
      case 'view.create': {
        const active =
          workspace.activeViewId === null ? undefined : views.get(workspace.activeViewId)
        const sources = active ? [active, ...views.items] : views.items
        const members: Member[] = []
        for (const id of new Set(operation.conceptIds))
          members.push(placeMember(id, members, sources))
        views.add({ id: operation.id, name: viewName(operation.name), members, pinned: false })
        workspace = { ...workspace, activeViewId: operation.id, savedViews: views.items }
        break
      }
      case 'view.rename':
        updateView(operation.id, (view) => {
          const name = viewName(operation.name)
          return view.name === name ? view : { ...view, name }
        })
        break
      case 'view.pin':
        updateView(operation.id, (view) =>
          view.pinned === operation.pinned ? view : { ...view, pinned: operation.pinned },
        )
        break
      case 'view.membership':
        if (!concepts.get(operation.conceptId)) fail('view.conceptId', 'Unknown concept')
        if (typeof operation.included !== 'boolean') fail('view.included', 'Expected a boolean')
        updateView(operation.viewId, (view) =>
          view.members.some(({ id }) => id === operation.conceptId) === operation.included
            ? view
            : {
                ...view,
                members: operation.included
                  ? [...view.members, placeMember(operation.conceptId, view.members)]
                  : view.members.filter(({ id }) => id !== operation.conceptId),
              },
        )
        break
      case 'view.remove':
        if (!workspace.savedViews.some((view) => view.id === operation.id))
          fail('view.id', 'Unknown view')
        views.removeWhere((view) => view.id === operation.id)
        workspace = {
          ...workspace,
          activeViewId: workspace.activeViewId === operation.id ? null : workspace.activeViewId,
          savedViews: views.items,
        }
        break
      case 'viewport.set':
        if (!registry.renderers.has(operation.rendererId))
          fail('rendererId', `Unknown renderer: ${operation.rendererId}`)
        workspace = {
          ...workspace,
          viewports: { ...workspace.viewports, [operation.rendererId]: { ...operation.value } },
        }
        break
      case 'preferences.vocab':
        if (!state.vocabs.some((vocab) => vocab.id === operation.id)) {
          throw new SchemaError([
            { path: 'activeVocabId', message: `Unknown vocabulary: ${operation.id}` },
          ])
        }
        preferences = { ...preferences, activeVocabId: operation.id }
        break
      case 'preferences.renderer':
        if (!registry.renderers.has(operation.id)) {
          throw new SchemaError([
            { path: 'activeRendererId', message: `Unknown renderer: ${operation.id}` },
          ])
        }
        preferences = { ...preferences, activeRendererId: operation.id }
        break
      case 'preferences.theme':
        if (!registry.themes.has(operation.id))
          fail('preferences.activeThemeId', `Unknown theme: ${operation.id}`)
        preferences = { ...preferences, activeThemeId: operation.id }
        break
      case 'preferences.locale':
        if (!isLocale(operation.value)) fail('preferences.locale', 'Unsupported locale')
        preferences = { ...preferences, locale: operation.value }
        break
      case 'preferences.intro-seen':
        preferences = { ...preferences, introSeen: true }
        break
      case 'preferences.mcpEnabled':
        if (typeof operation.value !== 'boolean')
          fail('preferences.mcpEnabled', 'Expected a boolean')
        preferences = { ...preferences, mcpEnabled: operation.value }
        break
      case 'preferences.panels':
        preferences = { ...preferences, panels: { ...operation.value } }
        break
      case 'preferences.disabledBundledActionPlugins':
        if (!Array.isArray(operation.value))
          fail('preferences.disabledBundledActionPlugins', 'Expected an array')
        preferences = { ...preferences, disabledBundledActionPlugins: [...operation.value] }
        break
      case 'preferences.canvasTabOrder.append': {
        if (!Array.isArray(operation.ids)) fail('preferences.canvasTabOrder', 'Expected an array')
        const order = preferences.canvasTabOrder ?? []
        const unseen = [...new Set(operation.ids)].filter((id) => !order.includes(id))
        if (unseen.length) preferences = { ...preferences, canvasTabOrder: [...order, ...unseen] }
        break
      }
      case 'preferences.inspectorTab':
        preferences = { ...preferences, inspectorTab: operation.value }
        break
      case 'preferences.relationGroups':
        preferences = { ...preferences, relationGroups: operation.value }
        break
      case 'preferences.section': {
        if (!sectionIds.includes(operation.id))
          fail('preferences.collapsedSections', 'Unknown section')
        if (typeof operation.open !== 'boolean') fail('section.open', 'Expected a boolean')
        const collapsed = preferences.collapsedSections ?? []
        if (!collapsed.includes(operation.id) === operation.open) break
        preferences = {
          ...preferences,
          collapsedSections: operation.open
            ? collapsed.filter((id) => id !== operation.id)
            : [...collapsed, operation.id],
        }
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
    const vocabularyTypes = new Set(
      state.vocabs.flatMap((vocab) => vocab.relationTypes.map((type) => type.id)),
    )
    const removed = new Set(
      relationEdit.changes
        .flatMap((change) => (change.before ? [change.before.value.predicate] : []))
        .filter((id) => !used.has(id) && !vocabularyTypes.has(id)),
    )
    types.removeWhere((type) => removed.has(type.id))
  }
  const typeEdit = types.finish()
  const viewEdit = views.finish()
  let candidate: GraphSnapshot = {
    concepts: conceptEdit.items,
    relations: relationEdit.items,
    relationTypes: typeEdit.items,
  }
  if (
    (candidate.concepts === state.graph.concepts &&
      candidate.relations === state.graph.relations &&
      candidate.relationTypes === state.graph.relationTypes) ||
    (reset && sameGraph(candidate, state.graph))
  ) {
    candidate = state.graph
    selected = explicitSelection
  }
  if (candidate !== state.graph) checkGraph(candidate)
  if (viewEdit.items !== workspace.savedViews)
    workspace = { ...workspace, savedViews: viewEdit.items }
  if (workspace !== state.workspace) {
    parseWorkspace(workspace)
    if (
      viewEdit.changes.some((change) =>
        change.after?.value.members.some(({ id }) => !concepts.get(id)),
      )
    )
      fail('view.members', 'Unknown concept')
    if (sameWorkspace(workspace, state.workspace)) workspace = state.workspace
  }
  if (preferences !== state.preferences) {
    parsePreferences(preferences)
    if (samePreferences(preferences, state.preferences)) preferences = state.preferences
  }
  selected = reconcileSelection(candidate, selected)
  if (
    conversationReplaced &&
    conversation !== state.conversation &&
    JSON.stringify(conversation) === JSON.stringify(state.conversation) &&
    !state.persistenceIssues.some(({ path }) => path.startsWith('conversation'))
  )
    conversation = state.conversation
  if (sameItems(selected, state.selected, (a, b) => a.kind === b.kind && a.id === b.id))
    selected = state.selected
  if (
    pluginStorage !== state.pluginStorage &&
    JSON.stringify(pluginStorage) === JSON.stringify(state.pluginStorage)
  )
    pluginStorage = state.pluginStorage
  const unchanged =
    candidate === state.graph &&
    workspace === state.workspace &&
    preferences === state.preferences &&
    selected === state.selected &&
    conversation === state.conversation &&
    documentId === state.documentId &&
    pluginStorage === state.pluginStorage
  const next = unchanged
    ? state
    : {
        ...state,
        graph: candidate,
        workspace,
        preferences,
        conversation,
        documentId,
        pluginStorage,
        selected,
        viewGraph: materialize(candidate, workspace, state),
      }
  let relationRewrites: { before: string; after: string }[] = []
  if (relationOrigins?.size) {
    const originalKeys = new Set(state.graph.relations.map(relationKey))
    const finalKeys = new Set(candidate.relations.map(relationKey))
    relationRewrites = [...relationOrigins].flatMap(([after, before]) =>
      finalKeys.has(after) && !finalKeys.has(before) && !originalKeys.has(after)
        ? [{ before, after }]
        : [],
    )
  }
  return {
    next,
    reset,
    relationRewrites,
    delta: {
      concepts: conceptEdit.changes,
      relations: relationEdit.changes,
      relationTypes: typeEdit.changes,
      views: viewChanges(viewEdit.changes),
    },
  }
}
