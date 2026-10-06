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
import { relationKey } from '@nesso/schema'
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
  const canvas = useRef<HTMLDivElement>(null)
  const { fitView, screenToFlowPosition } = useReactFlow()

  const nodes = graph.concepts.map((concept) =>
    conceptNode(concept, selected?.kind === 'concept' && selected.id === concept.id),
  )
  const edges = graph.relations.map((relation) =>
    relationEdge(relation, selected?.kind === 'relation' && selected.id === relationKey(relation)),
  )

  const onNodesChange = (changes: NodeChange<ConceptNode>[]) => {
    store.setConceptPositions(changes.flatMap((change) =>
      change.type === 'position' && change.position ? [{ id: change.id, position: change.position }] : [],
    ))
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
    const id = store.addConcept(placement())
    requestAnimationFrame(() => {
      if (canvas.current === element) store.setConceptPosition(id, placement())
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
