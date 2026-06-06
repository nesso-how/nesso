// SPDX-License-Identifier: MIT
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  useStore,
  type OnConnect,
  type OnMoveEnd,
  type OnConnectStart,
  type OnConnectEnd,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ConceptNode } from './ConceptNode'
import { NessoConnectionLine } from './NessoConnectionLine'
import { NessoEdge } from './NessoEdge'
import { RelationPicker } from './RelationPicker'
import { useGraphStore } from '@/store/graph'
import { computeFitViewport } from '@/lib/fitGraphViewport'
import { getSeedInitialFitZoom } from '@/data/seedGraph'
import { newConceptTopLeftAtFlowCenter } from '@/data/newConceptLayout'
import type { EdgeTypeName } from '@/types/graph'

const nodeTypes = { concept: ConceptNode }
const edgeTypes = { nesso: NessoEdge }

interface PendingConnection {
  source: string
  target: string
  screenX: number
  screenY: number
}

function ViewportZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const zoom = useStore((s) => s.transform[2])
  useEffect(() => {
    onZoomChange(zoom)
  }, [zoom, onZoomChange])
  return null
}

export function GraphCanvas({
  topInset = 0,
  bottomInset = 0,
  leftInset = 0,
  rightInset = 0,
  onViewportZoomChange,
}: {
  topInset?: number
  bottomInset?: number
  leftInset?: number
  rightInset?: number
  onViewportZoomChange?: (zoom: number) => void
}) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const addEdge = useGraphStore((s) => s.addEdge)
  const addNode = useGraphStore((s) => s.addNode)
  const syncFlowSelection = useGraphStore((s) => s.syncFlowSelection)
  const viewports = useGraphStore((s) => s.viewports)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const loadedToken = useGraphStore((s) => s.loadedToken)

  const { screenToFlowPosition } = useReactFlow()
  const defaultViewport =
    viewports[currentGraphId] ??
    computeFitViewport(
      nodes,
      {
        top: topInset,
        bottom: bottomInset,
        left: leftInset,
        right: rightInset,
      },
      getSeedInitialFitZoom(currentGraphId) ?? 1,
    )

  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null)
  const connectingSource = useRef<string | null>(null)
  const selectionSyncFrame = useRef<number | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // WKWebView: block native text selection while dragging on the canvas.
  useEffect(() => {
    const root = canvasRef.current
    if (!root) return
    const onSelectStart = (e: Event) => {
      if ((e.target as Element).closest('input, textarea')) return
      e.preventDefault()
    }
    root.addEventListener('selectstart', onSelectStart)
    return () => root.removeEventListener('selectstart', onSelectStart)
  }, [])

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    connectingSource.current = params.nodeId ?? null
  }, [])

  const onConnectEnd = useCallback<OnConnectEnd>((event) => {
    const target = (event.target as Element).closest('[data-id]')?.getAttribute('data-id')
    const source = connectingSource.current
    if (!source || !target || source === target) {
      connectingSource.current = null
      return
    }
    const e = event as MouseEvent
    setPendingConn({ source, target, screenX: e.clientX, screenY: e.clientY })
    connectingSource.current = null
  }, [])

  const onConnect = useCallback<OnConnect>((conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    setPendingConn({ source: conn.source, target: conn.target, screenX: 0, screenY: 0 })
  }, [])

  const onSelectionChange = useCallback(
    ({
      nodes: sel,
      edges: selEdges,
    }: {
      nodes: Array<{ id: string }>
      edges: Array<{ id: string }>
    }) => {
      if (selectionSyncFrame.current != null) {
        cancelAnimationFrame(selectionSyncFrame.current)
      }
      const nodeIds = sel.map((n) => n.id)
      const edgeIds = selEdges.map((e) => e.id)
      selectionSyncFrame.current = requestAnimationFrame(() => {
        selectionSyncFrame.current = null
        syncFlowSelection(nodeIds, edgeIds)
      })
    },
    [syncFlowSelection],
  )

  useEffect(
    () => () => {
      if (selectionSyncFrame.current != null) cancelAnimationFrame(selectionSyncFrame.current)
    },
    [],
  )

  const persistViewportOnMoveEnd = useCallback<OnMoveEnd>((_event, viewport) => {
    const { currentGraphId: id, saveViewport } = useGraphStore.getState()
    saveViewport(id, viewport)
  }, [])

  const handlePaneDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as Element
      if (!target.closest('.react-flow__pane')) return
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return

      event.preventDefault()
      const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const pos = newConceptTopLeftAtFlowCenter(x, y)
      addNode(pos.x, pos.y)
    },
    [addNode, screenToFlowPosition],
  )

  const onPickRelation = useCallback(
    (type: EdgeTypeName) => {
      if (!pendingConn) return
      addEdge(pendingConn.source, pendingConn.target, type)
      setPendingConn(null)
    },
    [pendingConn, addEdge],
  )

  // Compute sibling index: edges sharing the same unordered node pair get
  // ascending indices so they can be offset perpendicularly without overlap.
  const styledEdges = useMemo(() => {
    const pairCount: Record<string, number> = {}
    return edges.map((e) => {
      const key = [e.source, e.target].sort().join('—')
      const idx = pairCount[key] ?? 0
      pairCount[key] = idx + 1
      // Keep edge identity when only selection (or other props) change — avoids RF update storms.
      if (e.data?.siblingIdx === idx) return e
      return { ...e, data: { ...e.data, siblingIdx: idx } }
    })
  }, [edges])

  return (
    <div
      ref={canvasRef}
      onDoubleClick={handlePaneDoubleClick}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ReactFlow
        key={`${currentGraphId}-${loadedToken}`}
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        connectionLineComponent={NessoConnectionLine}
        onSelectionChange={onSelectionChange}
        onMoveEnd={persistViewportOnMoveEnd}
        zoomOnDoubleClick={false}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={35}
        defaultViewport={defaultViewport}
        minZoom={0.15}
        maxZoom={2.5}
        deleteKeyCode={null}
        selectionKeyCode={['Meta', 'Control']}
        multiSelectionKeyCode={['Meta', 'Control']}
        zoomActivationKeyCode="Alt"
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        {onViewportZoomChange && <ViewportZoomReporter onZoomChange={onViewportZoomChange} />}
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--grid-dot)" />
      </ReactFlow>

      {pendingConn && (
        <RelationPicker
          screenX={pendingConn.screenX}
          screenY={pendingConn.screenY}
          fromText={nodes.find((n) => n.id === pendingConn.source)?.data.text ?? ''}
          toText={nodes.find((n) => n.id === pendingConn.target)?.data.text ?? ''}
          onPick={onPickRelation}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  )
}
