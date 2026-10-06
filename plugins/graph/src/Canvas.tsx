import { useEffect, useRef, useState } from 'react'
import { Lock, LockOpen, Maximize, Plus, Trash2 } from 'lucide-react'
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
import { relationKey } from '@nesso/schema'
import { ConceptNodeView } from './ConceptNodeView'
import { ConnectionPreview } from './ConnectionPreview'
import { conceptNode, conceptNodeMinSize, relationEdge, type ConceptNodeSizes } from './adapters'
import type { ConceptNode, RelationEdge } from './types'
import { useNesso, useStore } from './store'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const fitViewOptions = { padding: 0.3, maxZoom: 1.2 }

export function Canvas() {
  const graph = useNesso((state) => state.viewGraph)
  const selected = useNesso((state) => state.selected)
  const conceptCount = useNesso((state) => state.graph.concepts.length)
  const defaultTypeId = useNesso((state) => state.vocabs.find((vocab) => vocab.id === state.preferences.activeVocabId)?.defaultTypeId)
  const view = useNesso((state) => state.workspace.activeViewId)
  const store = useStore()
  const flow = useStoreApi()
  const interactive = useFlowStore((state) => state.nodesDraggable || state.nodesConnectable || state.elementsSelectable)
  const LockIcon = interactive ? LockOpen : Lock
  const [initialViewport] = useState(() => store.getState().workspace.viewports.graph)
  const navigation = useRef(view)
  const reconnecting = useRef<RelationEdge | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const zoom = useFlowStore((state) => state.transform[2])
  const [sizes, setSizes] = useState<ConceptNodeSizes>({})

  const nodes = graph.concepts.map((concept) =>
    conceptNode(concept, selected?.kind === 'concept' && selected.id === concept.id, sizes[concept.id]),
  )
  const edges = graph.relations.map((relation) =>
    relationEdge(relation, selected?.kind === 'relation' && selected.id === relationKey(relation), graph, defaultTypeId, sizes),
  )

  const onObjectChanges = (kind: 'concept' | 'relation', changes: (NodeChange<ConceptNode> | EdgeChange<RelationEdge>)[]) => {
    for (const change of changes) {
      const state = store.getState()
      if (change.type === 'select') {
        if (change.selected) store.setSelection({ kind, id: change.id })
        else if (state.selected?.kind === kind && state.selected.id === change.id) store.setSelection(null)
      } else if (change.type === 'remove') {
        if (kind === 'relation') store.removeRelation(change.id)
        else if (state.graph.concepts.length > 1) store.removeConcept(change.id)
      }
    }
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
    store.setConceptPositions(changes.flatMap((change) =>
      change.type === 'position' && change.position ? [{ id: change.id, position: change.position }] : [],
    ))
    onObjectChanges('concept', changes)
  }

  const clearSelection = () => {
    reconnecting.current = null
    flow.getState().cancelConnection()
    flow.setState({ connectionClickStartHandle: null })
    store.setSelection(null)
  }

  const canDelete = selected !== null && (selected.kind === 'relation' || conceptCount > 1)

  const handleAdd = () => {
    const element = canvas.current
    if (!element) return
    const state = store.getState()
    const source = state.selected?.kind === 'concept'
      ? state.graph.concepts.find((concept) => concept.id === state.selected?.id)
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
    const id = store.addConcept(placement())
    requestAnimationFrame(() => {
      if (canvas.current === element) store.setConceptPosition(id, placement())
    })
  }

  const handleDelete = () => {
    const current = store.getState().selected
    if (current) onObjectChanges(current.kind, [{ type: 'remove', id: current.id }])
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
    <div ref={canvas} tabIndex={0} className="h-full w-full outline-none" onKeyDown={(event) => { if (event.key === 'Escape') clearSelection() }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={interactive}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => onObjectChanges('relation', changes)}
        onConnect={({ source, target }) => store.connect(source, target)}
        onReconnect={interactive ? (edge, { source, target }) => store.reconnectRelation(edge.id, source, target) : undefined}
        onReconnectStart={(_event, edge) => { reconnecting.current = edge }}
        onReconnectEnd={() => { reconnecting.current = null }}
        reconnectRadius={6 / zoom}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={({ source, target }) => {
          const relations = store.getState().graph.relations
          const predicate = relations.find((relation) => relationKey(relation) === reconnecting.current?.id)?.predicate ?? defaultTypeId
          return source !== target && !relations.some((relation) => relationKey(relation) !== reconnecting.current?.id && relation.source === source && relation.target === target && relation.predicate === predicate)
        }}
        onPaneClick={() => { clearSelection(); canvas.current?.focus() }}
        connectionLineComponent={ConnectionPreview}
        connectionLineStyle={{ stroke: 'var(--handle)', strokeWidth: 1.2, strokeDasharray: '4 4' }}
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveEnd={(_event, viewport) => store.setViewport('graph', viewport)}
        fitView={!initialViewport}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls showZoom={false} showFitView={false} showInteractive={false} orientation="horizontal">
          <ControlButton className="react-flow__controls-fitview" onClick={() => { void fitView(fitViewOptions) }} title="Fit View" aria-label="Fit View">
            <Maximize aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-interactive" onClick={() => flow.setState({ nodesDraggable: !interactive, nodesConnectable: !interactive, elementsSelectable: !interactive })} title={interactive ? 'Lock interactions' : 'Unlock interactions'} aria-label={interactive ? 'Lock interactions' : 'Unlock interactions'} aria-pressed={!interactive}>
            <LockIcon aria-hidden="true" />
          </ControlButton>
        </Controls>
        <Panel position="bottom-right" className="pointer-events-none font-mono text-[10px] text-muted-foreground" aria-label="Zoom level">{Math.round(zoom * 100)}%</Panel>
        <Controls position="top-right" orientation="horizontal" showZoom={false} showFitView={false} showInteractive={false}>
          <ControlButton onClick={handleDelete} disabled={!canDelete} title="Delete selected" aria-label="Delete selected">
            <Trash2 aria-hidden="true" />
          </ControlButton>
          <ControlButton onClick={handleAdd} title="Add concept" aria-label="Add concept">
            <Plus aria-hidden="true" />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  )
}
