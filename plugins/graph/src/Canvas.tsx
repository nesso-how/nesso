import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Lock, LockOpen, Maximize, Plus, Redo2, Trash2, Undo2 } from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ConnectionMode,
  Panel,
  ReactFlow,
  useReactFlow,
  useStore as useFlowStore,
  useStoreApi,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './styles.css'
import { newIri, relationKey } from '@nesso/schema'
import { ConceptNodeView } from './ConceptNodeView'
import { ConnectionPreview } from './ConnectionPreview'
import { conceptNode, conceptNodeMinSize, relationEdge, type ConceptNodeSizes } from './adapters'
import type { ConceptNode, RelationEdge } from './types'
import { useNesso, useStore } from './store'
import { useIsCompact } from './media'
import { selectionFromChanges } from './selection'
import { useTranslation } from './i18n'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const fitViewOptions = { padding: 0.3, maxZoom: 1.2 }
const multiSelectionKeys = ['Meta', 'Control', 'Shift']

export function Canvas() {
  const t = useTranslation()
  const graph = useNesso((state) => state.viewGraph)
  const selected = useNesso((state) => state.selected)
  const conceptCount = useNesso((state) => state.graph.concepts.length)
  const defaultTypeId = useNesso((state) => state.vocabs.find((vocab) => vocab.id === state.preferences.activeVocabId)?.defaultTypeId)
  const view = useNesso((state) => state.workspace.activeViewId)
  const viewName = useNesso((state) => state.workspace.savedViews.find((saved) => saved.id === state.workspace.activeViewId)?.name) ?? t('completeGraph')
  const viewCount = graph.concepts.length
  const store = useStore()
  const flow = useStoreApi()
  const readonly = useIsCompact()
  const flowInteractive = useFlowStore((state) => state.nodesDraggable || state.nodesConnectable || state.elementsSelectable)
  const interactive = !readonly && flowInteractive
  const LockIcon = interactive ? LockOpen : Lock
  const [initialViewport] = useState(() => store.getState().workspace.viewports.graph)
  const navigation = useRef(view)
  const reconnecting = useRef<RelationEdge | null>(null)
  const [reconnectDrag, setReconnectDrag] = useState(false)
  const dragGroup = useRef<string | undefined>(undefined)
  const canvas = useRef<HTMLDivElement>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const zoom = useFlowStore((state) => state.transform[2])
  const [sizes, setSizes] = useState<ConceptNodeSizes>({})

  const selectedConcepts = new Set(selected.filter((item) => item.kind === 'concept').map((item) => item.id))
  const selectedRelations = new Set(selected.filter((item) => item.kind === 'relation').map((item) => item.id))
  const singleSelection = selected.length === 1
  const nodes = graph.concepts.map((concept) =>
    conceptNode(concept, selectedConcepts.has(concept.id), sizes[concept.id]),
  )
  const edges = graph.relations.map((relation) => ({
    ...relationEdge(relation, selectedRelations.has(relationKey(relation)), singleSelection, graph, defaultTypeId, sizes),
    ariaLabel: t('relationFromTo', {
      source: graph.concepts.find((concept) => concept.id === relation.source)?.label ?? '',
      target: graph.concepts.find((concept) => concept.id === relation.target)?.label ?? '',
    }),
  }))

  const onObjectChanges = (kind: 'concept' | 'relation', changes: (NodeChange<ConceptNode> | EdgeChange<RelationEdge>)[]) => {
    const current = store.getState().selected
    const next = selectionFromChanges(current, kind, changes)
    if (next !== current) store.setSelection(next)
  }

  const onNodesChange = (changes: NodeChange<ConceptNode>[]) => {
    const dimensions = changes.flatMap((change) =>
      change.type === 'dimensions' && change.dimensions ? [{ id: change.id, size: change.dimensions }] : [],
    )
    if (dimensions.length) setSizes((previous) => {
      const next = { ...previous }
      for (const change of dimensions) next[change.id] = change.size
      return next
    })
    if (changes.some((change) => change.type === 'position' && change.dragging) && !dragGroup.current) dragGroup.current = newIri()
    const updates = changes.flatMap((change) =>
      change.type === 'position' && change.position ? [{ id: change.id, position: change.position }] : [],
    )
    if (!readonly && updates.length) store.setConceptPositions(updates, dragGroup.current)
    if (changes.some((change) => change.type === 'position' && change.dragging === false)) dragGroup.current = undefined
    onObjectChanges('concept', changes)
  }

  const clearSelection = () => {
    reconnecting.current = null
    setReconnectDrag(false)
    flow.getState().cancelConnection()
    flow.setState({ connectionClickStartHandle: null })
    store.setSelection([])
  }

  const canDelete = selected.length > 0 && selectedConcepts.size < conceptCount
  const canUndo = useNesso((state) => state.history.canUndo)
  const canRedo = useNesso((state) => state.history.canRedo)

  const handleAdd = () => {
    const element = canvas.current
    if (!element) return
    const state = store.getState()
    const source = state.selected.length === 1 && state.selected[0].kind === 'concept'
      ? state.graph.concepts.find((concept) => concept.id === state.selected[0].id)
      : undefined
    const placement = () => {
      const bounds = element.getBoundingClientRect()
      const topLeft = screenToFlowPosition({ x: bounds.left + 24, y: bounds.top + 24 })
      const bottomRight = screenToFlowPosition({ x: bounds.right - 24, y: bounds.bottom - 24 })
      const maxX = Math.max(topLeft.x, bottomRight.x - conceptNodeMinSize.width)
      const maxY = Math.max(topLeft.y, bottomRight.y - conceptNodeMinSize.height)
      const position = source
        ? { x: source.position.x + store.conceptPlacementOffset.x, y: source.position.y + store.conceptPlacementOffset.y }
        : { x: (topLeft.x + maxX) / 2, y: (topLeft.y + maxY) / 2 }
      return {
        x: Math.max(topLeft.x, Math.min(position.x, maxX)),
        y: Math.max(topLeft.y, Math.min(position.y, maxY)),
      }
    }
    const historyGroup = newIri()
    const id = store.addConcept(placement(), historyGroup)
    requestAnimationFrame(() => {
      if (canvas.current === element) store.setConceptPosition(id, placement(), historyGroup)
    })
  }

  const handleDelete = () => {
    const { selected, graph } = store.getState()
    if (selected.filter((item) => item.kind === 'concept').length >= graph.concepts.length) return
    store.applyOperations(selected.map(({ kind, id }) => ({ kind: kind === 'concept' ? 'concept.remove' : 'relation.remove', id })))
  }

  const handlePaneDoubleClick = (event: ReactMouseEvent) => {
    if (readonly) return
    const target = event.target as HTMLElement | null
    if (target?.closest?.('.react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__panel, button')) return
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    store.addConcept({ x: position.x - conceptNodeMinSize.width / 2, y: position.y - conceptNodeMinSize.height / 2 })
  }

  useEffect(() => {
    if (navigation.current === view) return
    navigation.current = view
    const frame = requestAnimationFrame(() => {
      void fitView({ ...fitViewOptions, duration: 300 })
    })
    return () => cancelAnimationFrame(frame)
  }, [view, fitView])

  return (
    <div ref={canvas} tabIndex={0} className={reconnectDrag ? 'h-full w-full outline-none graph-reconnecting' : 'h-full w-full outline-none'} onKeyDown={(event) => {
      if (event.key === 'Escape') clearSelection()
      if (!interactive) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDelete()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        const visible = store.getState().viewGraph
        store.setSelection([
          ...visible.concepts.map((concept) => ({ kind: 'concept' as const, id: concept.id })),
          ...visible.relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
        ])
      }
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        ariaLabelConfig={{
          'node.a11yDescription.default': t('nodeSelectionInstructions'),
          'node.a11yDescription.keyboardDisabled': t('nodeInstructions'),
          'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('nodeMoved', { x, y }),
          'edge.a11yDescription.default': t('relationInstructions'),
          'controls.ariaLabel': t('controls'),
          'controls.fitView.ariaLabel': t('fitView'),
          'controls.interactive.ariaLabel': t('toggleInteractions'),
        }}
        nodesDraggable={interactive}
        nodesConnectable={interactive && singleSelection}
        multiSelectionKeyCode={multiSelectionKeys}
        deleteKeyCode={null}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => onObjectChanges('relation', changes)}
        onConnect={readonly ? undefined : ({ source, target }) => store.connect(source, target)}
        onReconnect={interactive ? (edge, { source, target }) => store.reconnectRelation(edge.id, source, target) : undefined}
        onReconnectStart={(_event, edge) => { reconnecting.current = edge; setReconnectDrag(true) }}
        onReconnectEnd={() => { reconnecting.current = null; setReconnectDrag(false) }}
        reconnectRadius={5 / zoom}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={({ source, target }) => {
          const relations = store.getState().graph.relations
          const predicate = relations.find((relation) => relationKey(relation) === reconnecting.current?.id)?.predicate ?? defaultTypeId
          return source !== target && !relations.some((relation) => relationKey(relation) !== reconnecting.current?.id && relation.source === source && relation.target === target && relation.predicate === predicate)
        }}
        onPaneClick={() => { clearSelection(); canvas.current?.focus() }}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        connectionLineComponent={ConnectionPreview}
        connectionLineStyle={{ stroke: 'var(--handle)', strokeWidth: 1.2, strokeDasharray: '4 4' }}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveEnd={(_event, viewport) => store.setViewport('graph', viewport)}
        fitView={!initialViewport}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
      >
        <Panel position="top-left" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground">{viewName} · {t('conceptCount', { count: viewCount })}</Panel>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls showZoom={false} showFitView={false} showInteractive={false} orientation="horizontal">
          <ControlButton className="react-flow__controls-fitview" onClick={() => { void fitView(fitViewOptions) }} title={t('fitView')} aria-label={t('fitView')}>
            <Maximize aria-hidden="true" />
          </ControlButton>
          {!readonly && (
            <ControlButton className="react-flow__controls-interactive" onClick={() => flow.setState({ nodesDraggable: !interactive, nodesConnectable: !interactive && singleSelection, elementsSelectable: !interactive })} title={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-label={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-pressed={!interactive}>
              <LockIcon aria-hidden="true" />
            </ControlButton>
          )}
        </Controls>
        <Panel position="bottom-right" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground" aria-label={t('zoomLevel')}>{Math.round(zoom * 100)}%</Panel>
        {!readonly && (
          <Controls position="top-right" orientation="horizontal" showZoom={false} showFitView={false} showInteractive={false}>
            <ControlButton onClick={store.undo} disabled={!canUndo} title={t('undo')} aria-label={t('undo')}>
              <Undo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={store.redo} disabled={!canRedo} title={t('redo')} aria-label={t('redo')}>
              <Redo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={handleDelete} disabled={!canDelete} title={t('deleteSelected')} aria-label={t('deleteSelected')}>
              <Trash2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={handleAdd} title={t('addConcept')} aria-label={t('addConcept')}>
              <Plus aria-hidden="true" />
            </ControlButton>
          </Controls>
        )}
      </ReactFlow>
    </div>
  )
}
