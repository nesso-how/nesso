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
  type NodeMouseHandler,
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
    addEdge, setSelected, selected,
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

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    setSelected({ kind: 'node', id: node.id })
  }, [setSelected])

  const onPaneClick = useCallback(() => {
    setSelected(null)
  }, [setSelected])

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
      return {
        ...e,
        selected: selected?.kind === 'edge' && selected.id === e.id,
        data: { ...e.data, siblingIdx: idx },
      }
    })
  }, [edges, selected])

  const styledNodes = useMemo(() => nodes.map(n => ({
    ...n,
    selected: selected?.kind === 'node' && selected.id === n.id,
  })), [nodes, selected])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        connectionLineComponent={NessoConnectionLine}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={persistViewportOnMoveEnd}
        connectionMode={ConnectionMode.Loose}
        defaultViewport={defaultViewport}
        minZoom={0.15}
        maxZoom={2.5}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        {onViewportZoomChange && (
          <ViewportZoomReporter onZoomChange={onViewportZoomChange} />
        )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={0.6}
          color="rgba(26,24,20,0.08)"
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
