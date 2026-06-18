// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  type OnMoveEnd,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NessoGraph } from '@nesso-how/graph'
import { ConceptNode } from './ConceptNode'
import { NessoConnectionLine } from './NessoConnectionLine'
import { GraphContextMenu } from './GraphContextMenu'
import { EmptyCanvasHint } from './EmptyCanvasHint'
import { useGraphContextMenu } from './useGraphContextMenu'
import { useConnectRelation } from './useConnectRelation'
import { RelationPicker } from '@/components/ui/RelationPicker'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'
import { computeFitViewport } from '@/lib/fitGraphViewport'
import { styleEdges } from '@/lib/styleEdges'
import { getSeedInitialFitZoom } from '@/data/seedGraph'
import { newConceptTopLeftAtFlowCenter } from '@/data/newConceptLayout'
import type { EdgeTypeName } from '@/types/graph'

const nodeTypes = { concept: ConceptNode }

export function GraphCanvas({
  topInset = 0,
  bottomInset = 0,
  leftInset = 0,
  rightInset = 0,
  onFit,
}: {
  topInset?: number
  bottomInset?: number
  leftInset?: number
  rightInset?: number
  onFit: () => void
}) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const addNode = useGraphStore((s) => s.addNode)
  const syncFlowSelection = useGraphStore((s) => s.syncFlowSelection)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const loadedToken = useGraphStore((s) => s.loadedToken)
  const graphDisplay = useGraphStore((s) => s.graphDisplay)
  const categoryPalette = useGraphStore((s) => s.settings.categoryPalette)
  const selected = useGraphStore((s) => s.selected)
  const t = useT()

  const getRelationLabel = useCallback((type: EdgeTypeName) => t.relationTypes.types[type], [t])
  const isItemSelected = useCallback(
    (kind: 'node' | 'edge', id: string) => selected?.kind === kind && selected.id === id,
    [selected],
  )

  const { screenToFlowPosition } = useReactFlow()
  // Only read at mount of the keyed NessoGraph below — memoized so the O(N)
  // fit computation doesn't run again on every drag-frame re-render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadedToken forces a re-read when the same graph is reloaded from disk (state is read via getState()).
  const defaultViewport = useMemo(() => {
    const s = useGraphStore.getState()
    return (
      s.viewports[currentGraphId] ??
      computeFitViewport(
        s.nodes,
        {
          top: topInset,
          bottom: bottomInset,
          left: leftInset,
          right: rightInset,
        },
        getSeedInitialFitZoom(currentGraphId) ?? 1,
      )
    )
  }, [currentGraphId, loadedToken, topInset, bottomInset, leftInset, rightInset])

  const { ctxMenu, closeCtxMenu, onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu } =
    useGraphContextMenu()
  const { pendingConn, setPendingConn, onConnectStart, onConnectEnd, onConnect, onPickRelation } =
    useConnectRelation()
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

  const styledEdges = useMemo(() => styleEdges(edges), [edges])

  return (
    <div
      ref={canvasRef}
      onDoubleClick={handlePaneDoubleClick}
      style={{ position: 'absolute', inset: 0 }}
    >
      <NessoGraph
        key={`${currentGraphId}-${loadedToken}`}
        nodes={nodes}
        edges={styledEdges}
        display={graphDisplay}
        palette={categoryPalette}
        categoryColorMode="css"
        getRelationLabel={getRelationLabel}
        isItemSelected={isItemSelected}
        nodeTypes={nodeTypes}
        nodesDraggable={true}
        nodesConnectable={true}
        fitView={false}
        defaultViewport={defaultViewport}
        minZoom={0.15}
        maxZoom={2.5}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onMoveEnd={persistViewportOnMoveEnd}
        reactFlowProps={{
          zoomOnDoubleClick: false,
          connectionMode: ConnectionMode.Loose,
          connectionRadius: 35,
          deleteKeyCode: null,
          selectionKeyCode: ['Meta', 'Control'],
          multiSelectionKeyCode: ['Meta', 'Control'],
          zoomActivationKeyCode: 'Alt',
          proOptions: { hideAttribution: true },
          connectionLineComponent: NessoConnectionLine,
          style: { background: 'transparent' },
          onNodeContextMenu,
          onEdgeContextMenu,
          onPaneContextMenu,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--grid-dot)" />
      </NessoGraph>

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

      {nodes.length === 0 && (
        <EmptyCanvasHint
          topInset={topInset}
          bottomInset={bottomInset}
          leftInset={leftInset}
          rightInset={rightInset}
        />
      )}

      {ctxMenu && <GraphContextMenu menu={ctxMenu} onClose={closeCtxMenu} onFit={onFit} />}
    </div>
  )
}
