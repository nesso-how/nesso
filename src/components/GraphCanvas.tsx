// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
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
  const zoom = useStore(s => s.transform[2])
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
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    addEdge, setSelected, setSelectedIds,
    viewports, currentGraphId,
  } = useGraphStore()

  const defaultViewport = viewports[currentGraphId] ?? { x: 0, y: 0, zoom: 0.75 }

  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null)
  const connectingSource = useRef<string | null>(null)

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    connectingSource.current = params.nodeId ?? null
  }, [])

  const onConnectEnd = useCallback<OnConnectEnd>((event) => {
    const target = (event.target as Element).closest('[data-id]')?.getAttribute('data-id')
    const source = connectingSource.current
    if (!source || !target || source === target) { connectingSource.current = null; return }
    const e = event as MouseEvent
    setPendingConn({ source, target, screenX: e.clientX, screenY: e.clientY })
    connectingSource.current = null
  }, [])

  const onConnect = useCallback<OnConnect>((conn) => {
    if (!conn.source || !conn.target) return
    setPendingConn({ source: conn.source, target: conn.target, screenX: 0, screenY: 0 })
  }, [])

  const onSelectionChange = useCallback(
    ({ nodes: sel, edges: selEdges }: { nodes: Array<{ id: string }>, edges: Array<{ id: string }> }) => {
      setSelectedIds(sel.map(n => n.id))
      if (sel.length === 1 && selEdges.length === 0) {
        setSelected({ kind: 'node', id: sel[0].id })
      } else if (selEdges.length === 1 && sel.length === 0) {
        setSelected({ kind: 'edge', id: selEdges[0].id })
      } else {
        setSelected(null)
      }
    },
    [setSelected, setSelectedIds]
  )

  const persistViewportOnMoveEnd = useCallback<OnMoveEnd>((_event, viewport) => {
    const { currentGraphId: id, saveViewport } = useGraphStore.getState()
    saveViewport(id, viewport)
  }, [])

  const onPickRelation = useCallback((type: EdgeTypeName) => {
    if (!pendingConn) return
    addEdge(pendingConn.source, pendingConn.target, type)
    setPendingConn(null)
  }, [pendingConn, addEdge])

  // Compute sibling index: edges sharing the same unordered node pair get
  // ascending indices so they can be offset perpendicularly without overlap.
  const styledEdges = useMemo(() => {
    const pairCount: Record<string, number> = {}
    return edges.map(e => {
      const key = [e.source, e.target].sort().join('—')
      const idx = pairCount[key] ?? 0
      pairCount[key] = idx + 1
      return { ...e, data: { ...e.data, siblingIdx: idx } }
    })
  }, [edges])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
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
        connectionMode={ConnectionMode.Loose}
        connectionRadius={35}
        defaultViewport={defaultViewport}
        minZoom={0.15}
        maxZoom={2.5}
        deleteKeyCode={['Delete', 'Backspace']}
        selectionKeyCode='Shift'
        multiSelectionKeyCode={['Meta', 'Control']}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        {onViewportZoomChange && (
          <ViewportZoomReporter onZoomChange={onViewportZoomChange} />
        )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.1}
          color="var(--grid-dot)"
        />
      </ReactFlow>

      {pendingConn && (
        <RelationPicker
          screenX={pendingConn.screenX}
          screenY={pendingConn.screenY}
          fromText={nodes.find(n => n.id === pendingConn.source)?.data.text ?? ''}
          toText={nodes.find(n => n.id === pendingConn.target)?.data.text ?? ''}
          onPick={onPickRelation}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  )
}
