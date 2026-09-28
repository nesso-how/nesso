import { useCallback, useEffect, type MouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ConceptNodeView } from '@/components/graph/ConceptNodeView'
import { RelationEdgeView } from '@/components/graph/RelationEdgeView'
import { useGraphStore } from '@/store/graph'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const edgeTypes: EdgeTypes = { relation: RelationEdgeView }

export function Canvas() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const focusId = useGraphStore((state) => state.focusId)
  const onNodesChange = useGraphStore((state) => state.onNodesChange)
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange)
  const connect = useGraphStore((state) => state.connect)
  const addConcept = useGraphStore((state) => state.addConcept)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const visible = new Set([focusId])
  for (const edge of edges) {
    if (edge.source === focusId) visible.add(edge.target)
    if (edge.target === focusId) visible.add(edge.source)
  }
  const visibleNodes = nodes.filter((node) => visible.has(node.id))
  const visibleEdges = edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target))

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.3, maxZoom: 1.2, duration: 300 })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusId, fitView])

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!(event.target as HTMLElement).classList.contains('react-flow__pane')) return
      addConcept(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [addConcept, screenToFlowPosition],
  )

  return (
    <div className="h-full w-full" onDoubleClick={handleDoubleClick}>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        // The pane's double-click adds a concept (handled on the wrapper below).
        zoomOnDoubleClick={false}
        connectionLineStyle={{ stroke: 'var(--muted-foreground)', strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
