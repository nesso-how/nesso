import { useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './styles.css'
import { newIri, relationKey } from '@nesso/schema'
import { ConceptNodeView } from './ConceptNodeView'
import { RelationEdgeView } from './RelationEdgeView'
import { conceptNode, conceptNodeSize, relationEdge } from './adapters'
import type { ConceptNode, RelationEdge } from './types'
import { useNesso, useStore } from './store'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const edgeTypes: EdgeTypes = { relation: RelationEdgeView }

export function Canvas() {
  const graph = useNesso((state) => state.viewGraph)
  const selected = useNesso((state) => state.selected)
  const conceptCount = useNesso((state) => state.graph.concepts.length)
  const view = useNesso((state) => state.workspace.activeViewId)
  const store = useStore()
  const [initialViewport] = useState(() => store.getState().workspace.viewports.graph)
  const navigation = useRef(view)
  const dragGroup = useRef<string | undefined>(undefined)
  const canvas = useRef<HTMLDivElement>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()

  const nodes = graph.concepts.map((concept) =>
    conceptNode(concept, selected?.kind === 'concept' && selected.id === concept.id),
  )
  const edges = graph.relations.map((relation) =>
    relationEdge(relation, selected?.kind === 'relation' && selected.id === relationKey(relation)),
  )

  const onNodesChange = (changes: NodeChange<ConceptNode>[]) => {
    if (changes.some((change) => change.type === 'position' && change.dragging) && !dragGroup.current) dragGroup.current = newIri()
    const updates = changes.flatMap((change) =>
      change.type === 'position' && change.position ? [{ id: change.id, position: change.position }] : [],
    )
    if (updates.length) store.applyOperations([{ kind: 'concept.positions', updates }], { historyGroup: dragGroup.current })
    if (changes.some((change) => change.type === 'position' && change.dragging === false)) dragGroup.current = undefined
    for (const change of changes) {
      const state = store.getState()
      if (change.type === 'select') {
        if (change.selected) store.setSelection({ kind: 'concept', id: change.id })
        else if (state.selected?.kind === 'concept' && state.selected.id === change.id) store.setSelection(null)
      } else if (change.type === 'remove' && state.graph.concepts.length > 1) store.removeConcept(change.id)
    }
  }

  const onEdgesChange = (changes: EdgeChange<RelationEdge>[]) => {
    for (const change of changes) {
      const state = store.getState()
      if (change.type === 'select') {
        if (change.selected) store.setSelection({ kind: 'relation', id: change.id })
        else if (state.selected?.kind === 'relation' && state.selected.id === change.id) store.setSelection(null)
      } else if (change.type === 'remove') store.removeRelation(change.id)
    }
  }

  const onConnect = ({ source, target }: Connection) => {
    if (source && target) store.connect(source, target)
  }

  const canDelete = selected !== null && (selected.kind === 'relation' || conceptCount > 1)
  const canUndo = useNesso((state) => state.history.canUndo)
  const canRedo = useNesso((state) => state.history.canRedo)

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
      const maxX = Math.max(topLeft.x, bottomRight.x - conceptNodeSize.width)
      const maxY = Math.max(topLeft.y, bottomRight.y - conceptNodeSize.height)
      const position = source
        ? { x: source.position.x + 160, y: source.position.y + 100 }
        : { x: (topLeft.x + maxX) / 2, y: (topLeft.y + maxY) / 2 }
      return {
        x: Math.max(topLeft.x, Math.min(position.x, maxX)),
        y: Math.max(topLeft.y, Math.min(position.y, maxY)),
      }
    }
    const id = newIri()
    const historyGroup = newIri()
    store.applyOperations([{ kind: 'concept.add', id, position: placement() }], { historyGroup })
    requestAnimationFrame(() => {
      if (canvas.current === element) store.applyOperations([{ kind: 'concept.position', id, value: placement() }], { historyGroup })
    })
  }

  const handleDelete = () => {
    const state = store.getState()
    const current = state.selected
    if (!current) return
    if (current.kind === 'concept') {
      if (state.graph.concepts.length > 1) store.removeConcept(current.id)
    } else {
      store.removeRelation(current.id)
    }
  }

  useEffect(() => {
    if (navigation.current === view) return
    navigation.current = view
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.3, maxZoom: 1.2, duration: 300 })
    })
    return () => cancelAnimationFrame(frame)
  }, [view, fitView])

  return (
    <div ref={canvas} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => store.setSelection(null)}
        connectionLineStyle={{ stroke: 'var(--edge)', strokeWidth: 1 }}
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveEnd={(_event, viewport) => store.setViewport('graph', viewport)}
        fitView={!initialViewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls showZoom={false} />
        <Controls position="top-right" orientation="horizontal" showZoom={false} showFitView={false} showInteractive={false}>
          <ControlButton onClick={store.undo} disabled={!canUndo} title="Undo" aria-label="Undo">
            <svg viewBox="0 0 24 24">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </ControlButton>
          <ControlButton onClick={store.redo} disabled={!canRedo} title="Redo" aria-label="Redo">
            <svg viewBox="0 0 24 24">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
            </svg>
          </ControlButton>
          <ControlButton onClick={handleDelete} disabled={!canDelete} title="Delete selected" aria-label="Delete selected">
            <svg viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </ControlButton>
          <ControlButton onClick={handleAdd} title="Add concept" aria-label="Add concept">
            <svg viewBox="0 0 24 24">
              <path d="M13 11V3h-2v8H3v2h8v8h2v-8h8v-2h-8z" />
            </svg>
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  )
}
