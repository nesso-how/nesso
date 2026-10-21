import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Copy, ListChecks, Lock, LockOpen, Layers, Maximize, ClipboardPaste, Plus, Redo2, Scissors, Trash2, Undo2 } from 'lucide-react'
import type { Selection } from '@nesso/plugin'
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ConnectionMode,
  Panel,
  ReactFlow,
  getViewportForBounds,
  useNodesInitialized,
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
import { GraphContextMenu } from './GraphContextMenu'
import { createGraphElements, conceptNodeMinSize, containsPoint, indexGraph, outsideEdge, outsideNode, type ConceptNodeSizes } from './adapters'
import type { ConceptNode, RelationEdge } from './types'
import { useNesso, useCanvasContext, type CanvasProps } from './store'
import { selectionForContextMenu, selectionFromChanges } from './selection'
import { useTranslation } from './i18n'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const fitViewOptions = { padding: 0.3, maxZoom: 1.2 }
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const multiSelectionKeys = ['Meta', 'Control', 'Shift']
type ContextMenuTarget = Selection[number]['kind'] | 'pane' | 'selection'

export function Canvas({ readOnly = false, preview = false, bottomInset = 0, conceptLabelMaxLength, focusRef: canvas }: CanvasProps) {
  const t = useTranslation()
  const graph = useNesso((state) => state.viewGraph)
  const indexed = useMemo(() => indexGraph(graph), [graph])
  const selected = useNesso((state) => state.selected)
  const fullGraph = useNesso((state) => state.graph)
  const view = useNesso((state) => state.workspace.activeViewId)
  const defaultTypeId = useNesso((state) => state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)?.defaultTypeId)
  const viewName = useNesso((state) => state.workspace.savedViews.find((saved) => saved.id === state.workspace.activeViewId)?.name) ?? t('completeGraph')
  const viewCount = graph.concepts.length
  const { store, commands } = useCanvasContext()
  const write = store.applyOperations
  const flow = useStoreApi()
  const [locked, setLocked] = useState(false)
  const interactive = !readOnly && !locked
  const LockIcon = interactive ? LockOpen : Lock
  const [initialViewport] = useState(() => store.getState().workspace.viewports['concept-map'])
  const navigation = useRef(view)
  const reconnecting = useRef<RelationEdge | null>(null)
  const [reconnectDrag, setReconnectDrag] = useState(false)
  const dragGroup = useRef<string | undefined>(undefined)
  const hasOverlay = preview
  const framed = useRef(false)
  const framedGraph = useRef(graph)
  const width = useFlowStore((state) => state.width)
  const height = useFlowStore((state) => state.height)
  const nodesInitialized = useNodesInitialized()
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300
  const animatedFraming = useMemo(() => ({ ...fitViewOptions, duration, ease: easeOut, interpolate: 'linear' as const }), [duration])
  const paneSelection = useRef<Selection>([])
  const [editId, setEditId] = useState<string | null>(null)
  const { fitView, screenToFlowPosition, getNodes, getNodesBounds, setViewport } = useReactFlow()
  const zoom = useFlowStore((state) => state.transform[2])
  const [sizes, setSizes] = useState<ConceptNodeSizes>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null)
  const [outside, setOutside] = useState(false)
  const outsideActive = outside && view !== null
  const [adapt] = useState(createGraphElements)
  const selection = useCallback((value: Selection) => {
    if (readOnly && !hasOverlay) return
    write([{ kind: 'selection.set', value }])
  }, [write, readOnly, hasOverlay])
  const ariaLabelConfig = useMemo(() => ({
    'node.a11yDescription.default': t('nodeSelectionInstructions'),
    'node.a11yDescription.keyboardDisabled': t('nodeInstructions'),
    'node.a11yDescription.ariaLiveMessage': ({ x, y }: { x: number; y: number }) => t('nodeMoved', { x, y }),
    'edge.a11yDescription.default': t('relationInstructions'),
    'controls.ariaLabel': t('controls'),
    'controls.fitView.ariaLabel': t('fitView'),
    'controls.interactive.ariaLabel': t('toggleInteractions'),
  }), [t])

  const singleSelection = selected.length === 1
  const outsideGraph = useMemo(() => {
    if (!outsideActive) return null
    const visible = new Set(graph.concepts.map((concept) => concept.id))
    return {
      indexed: indexGraph(fullGraph),
      concepts: fullGraph.concepts.filter((concept) => !visible.has(concept.id)),
      relations: fullGraph.relations.filter((relation) => !(visible.has(relation.source) && visible.has(relation.target))),
    }
  }, [outsideActive, graph, fullGraph])
  const elements = adapt({
    graph, indexed, selected, sizes, defaultTypeId,
    editing: { id: editId, enabled: interactive, maxLength: conceptLabelMaxLength, onChange: setEditId },
    label: (relation) => t('relationFromTo', {
      source: indexed.concepts.get(relation.source)?.label ?? '',
      target: indexed.concepts.get(relation.target)?.label ?? '',
    }),
  })
  const nodes = useMemo(() => outsideGraph ? [...outsideGraph.concepts.map((concept) => outsideNode(concept, sizes[concept.id])), ...elements.nodes] : elements.nodes, [outsideGraph, sizes, elements.nodes])
  const edges = useMemo(() => outsideGraph ? [...outsideGraph.relations.map((relation) => outsideEdge(relation, outsideGraph.indexed, defaultTypeId, sizes)), ...elements.edges] : elements.edges, [outsideGraph, sizes, defaultTypeId, elements.edges])

  const onObjectChanges = useCallback((kind: 'concept' | 'relation', changes: (NodeChange<ConceptNode> | EdgeChange<RelationEdge>)[]) => {
    if (readOnly && !hasOverlay) return
    const state = store.getState()
    const current = state.selected
    const next = selectionFromChanges(current, kind, changes)
    if (next !== current) selection(next)
  }, [readOnly, hasOverlay, store, selection])

  const onNodesChange = useCallback((changes: NodeChange<ConceptNode>[]) => {
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
    const complete = updates.length > 0 && !changes.some((change) => change.type === 'position' && change.dragging)
    if (!readOnly && updates.length) {
      write([{ kind: 'concept.positions', updates }], { historyGroup: dragGroup.current })
    }
    if (complete) dragGroup.current = undefined
    onObjectChanges('concept', changes)
  }, [readOnly, write, onObjectChanges])

  const cancelConnection = () => {
    reconnecting.current = null
    setReconnectDrag(false)
    flow.getState().cancelConnection()
    flow.setState({ connectionClickStartHandle: null })
  }

  const canDelete = interactive && selected.length > 0
  const canCut = canDelete && selected.filter(({ kind }) => kind === 'concept').length < fullGraph.concepts.length
  const canUndo = useNesso((state) => state.history.canUndo)
  const canRedo = useNesso((state) => state.history.canRedo)

  const outsideFit = useRef(false)
  const outsideLabel = t(outsideActive ? 'hideRestOfGraph' : 'showRestOfGraph')
  const toggleOutside = () => {
    outsideFit.current = true
    setOutside((value) => !value)
  }

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
    const id = newIri()
    write([{ kind: 'concept.add', id, position: placement() }], { historyGroup })
    setEditId(id)
    requestAnimationFrame(() => {
      const current = store.getState()
      if (canvas.current === element && current.workspace.activeViewId === state.workspace.activeViewId && current.graph.concepts.some((concept) => concept.id === id)) write([{ kind: 'concept.position', id, value: placement() }], { historyGroup })
    })
  }

  const handleDelete = () => {
    setContextMenu(null)
    commands.deleteSelection()
  }

  const selectAll = () => {
    const { viewGraph } = store.getState()
    selection([
      ...viewGraph.concepts.map(({ id }) => ({ kind: 'concept' as const, id })),
      ...viewGraph.relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
    ])
  }

  const addConceptAt = (point: { x: number; y: number }, selection = store.getState().selected) => {
    const position = screenToFlowPosition(point)
    const id = newIri()
    write([
      { kind: 'selection.set', value: selection },
      { kind: 'concept.add', id, position: { x: position.x - conceptNodeMinSize.width / 2, y: position.y - conceptNodeMinSize.height / 2 } },
    ])
    setEditId(id)
  }

  const openContextMenu = useCallback((point: { x: number; y: number }, item?: Selection[number], target: ContextMenuTarget = item?.kind ?? 'pane') => {
    if (interactive && item) selection(selectionForContextMenu(store.getState().selected, item))
    setContextMenu({ ...point, target })
  }, [interactive, selection, store])

  const handleContextMenu = useCallback((event: Pick<ReactMouseEvent, 'preventDefault' | 'clientX' | 'clientY'>, item?: Selection[number], target?: ContextMenuTarget) => {
    if (readOnly) return
    event.preventDefault()
    openContextMenu({ x: event.clientX, y: event.clientY }, item, target)
  }, [readOnly, openContextMenu])
  const objectHandlers = useMemo(() => ({
    onNodeContextMenu: (event: ReactMouseEvent, node: ConceptNode) => handleContextMenu(event, { kind: 'concept', id: node.id }),
    onEdgeContextMenu: (event: ReactMouseEvent, edge: RelationEdge) => handleContextMenu(event, { kind: 'relation', id: edge.id }),
    onReconnect: interactive ? (edge: RelationEdge, { source, target }: { source: string; target: string }) => { write([{ kind: 'relation.reconnect', id: edge.id, source, target }]) } : undefined,
    onReconnectStart: (_event: unknown, edge: RelationEdge) => { reconnecting.current = edge; setReconnectDrag(true) },
    onReconnectEnd: () => { reconnecting.current = null; setReconnectDrag(false) },
  }), [handleContextMenu, interactive, write])

  const openKeyboardContextMenu = (target: Element) => {
    if (target.closest('button')) return
    const object = target.closest('.react-flow__node, .react-flow__edge')
    const bounds = (object ?? target).getBoundingClientRect()
    const id = object?.getAttribute('data-id')
    const item = object && id ? { kind: object.classList.contains('react-flow__node') ? 'concept' as const : 'relation' as const, id } : undefined
    openContextMenu({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, item)
  }

  const handlePaneDoubleClick = (event: ReactMouseEvent) => {
    if (!interactive) return
    const target = event.target as HTMLElement | null
    if (target?.closest?.('.react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__panel, button')) return
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    if (outsideGraph?.concepts.some((concept) => containsPoint(concept, sizes[concept.id] ?? conceptNodeMinSize, point))) return
    addConceptAt({ x: event.clientX, y: event.clientY }, paneSelection.current)
  }

  useEffect(() => {
    if (readOnly) return
    const focus = () => canvas.current?.focus()
    focus()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [readOnly, canvas])

  useEffect(() => {
    if (hasOverlay || navigation.current === view) return
    navigation.current = view
    const frame = requestAnimationFrame(() => {
      setContextMenu(null)
      dragGroup.current = undefined
      void fitView(animatedFraming)
    })
    return () => cancelAnimationFrame(frame)
  }, [view, fitView, hasOverlay, animatedFraming])

  useEffect(() => {
    if (!outsideFit.current) return
    outsideFit.current = false
    void fitView(animatedFraming)
  })

  useEffect(() => {
    if (!hasOverlay || !nodesInitialized || !width || !height) return
    const viewport = getViewportForBounds(getNodesBounds(getNodes()), width, Math.max(1, height - bottomInset), 0.2, 1.2, '40px')
    const changed = framedGraph.current !== graph
    framedGraph.current = graph
    const animate = framed.current && changed
    void setViewport(viewport, animate ? { duration, ease: easeOut, interpolate: 'linear' } : { duration: 0 })
    framed.current = true
  }, [hasOverlay, bottomInset, nodesInitialized, width, height, graph, getNodes, getNodesBounds, setViewport, duration])

  return (
    <div ref={canvas} tabIndex={0} className={reconnectDrag ? 'h-full w-full outline-none graph-reconnecting' : 'h-full w-full outline-none'} onKeyDown={(event) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (readOnly) return
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        openKeyboardContextMenu(event.target as Element)
        return
      }
      if (contextMenu) {
        event.stopPropagation()
        return
      }
      if (event.key === 'Escape') {
        const state = flow.getState()
        if (state.connection.inProgress || state.connectionClickStartHandle || reconnecting.current) {
          cancelConnection()
          event.preventDefault()
        }
      }
    }}>
      <ReactFlow
        className={hasOverlay ? 'graph-presentation' : undefined}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        ariaLabelConfig={ariaLabelConfig}
        nodesDraggable={interactive}
        elementsSelectable={interactive || hasOverlay}
        nodesConnectable={interactive && singleSelection}
        edgesReconnectable={interactive}
        multiSelectionKeyCode={multiSelectionKeys}
        deleteKeyCode={null}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => onObjectChanges('relation', changes)}
        onConnect={interactive ? ({ source, target }) => { write([{ kind: 'relation.connect', source, target }]) } : undefined}
        {...objectHandlers}
        reconnectRadius={5 / zoom}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={({ source, target }) => {
          const relations = store.getState().graph.relations
          const predicate = relations.find((relation) => relationKey(relation) === reconnecting.current?.id)?.predicate ?? defaultTypeId
          return source !== target && !relations.some((relation) => relationKey(relation) !== reconnecting.current?.id && relation.source === source && relation.target === target && relation.predicate === predicate)
        }}
        onPaneClick={(event) => {
          if (event.detail === 1) paneSelection.current = store.getState().selected
          cancelConnection()
          selection([])
          canvas.current?.focus()
        }}
        onPaneContextMenu={(event) => handleContextMenu(event)}
        onSelectionContextMenu={(event) => handleContextMenu(event, undefined, 'selection')}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        connectionLineComponent={ConnectionPreview}
        connectionLineStyle={{ stroke: 'var(--handle)', strokeWidth: 1.2, strokeDasharray: '4 4' }}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveStart={() => setContextMenu(null)}
        onMoveEnd={readOnly ? undefined : (_event, value) => { write([{ kind: 'viewport.set', rendererId: 'concept-map', value }]) }}
        fitView={!initialViewport && !hasOverlay}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
      >
        {!hasOverlay && <Panel position="top-left" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground">{viewName} · {t('conceptCount', { count: viewCount })}</Panel>}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--node-border)" />
        {!hasOverlay && (
          <Controls showZoom={false} showFitView={false} showInteractive={false} orientation="horizontal">
            <ControlButton className="react-flow__controls-fitview" onClick={() => { void fitView(animatedFraming) }} title={t('fitView')} aria-label={t('fitView')}>
              <Maximize aria-hidden="true" />
            </ControlButton>
            {!readOnly && (
              <>
                <ControlButton className="react-flow__controls-interactive" onClick={() => setLocked((value) => !value)} title={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-label={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-pressed={!interactive}>
                  <LockIcon aria-hidden="true" />
                </ControlButton>
                <ControlButton className="react-flow__controls-outside" onClick={toggleOutside} disabled={view === null} title={outsideLabel} aria-label={outsideLabel} aria-pressed={outsideActive}>
                  <Layers aria-hidden="true" />
                </ControlButton>
              </>
            )}
          </Controls>
        )}
        {!hasOverlay && <Panel position="bottom-right" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground" aria-label={t('zoomLevel')}>{Math.round(zoom * 100)}%</Panel>}
        {!readOnly && (
          <Controls position="top-right" orientation="horizontal" showZoom={false} showFitView={false} showInteractive={false}>
            <ControlButton onClick={store.undo} disabled={!canUndo} title={t('undo')} aria-label={t('undo')}>
              <Undo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={store.redo} disabled={!canRedo} title={t('redo')} aria-label={t('redo')}>
              <Redo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void commands.copy() }} disabled={selected.length === 0} title={t('copy')} aria-label={t('copy')}>
              <Copy aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void commands.copy(true) }} disabled={!canCut} title={t('cut')} aria-label={t('cut')}>
              <Scissors aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void commands.paste() }} disabled={!interactive} title={t('paste')} aria-label={t('paste')}>
              <ClipboardPaste aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={handleDelete} disabled={!canDelete} title={t('delete')} aria-label={t('delete')}>
              <Trash2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={handleAdd} disabled={!interactive} title={t('addConcept')} aria-label={t('addConcept')}>
              <Plus aria-hidden="true" />
            </ControlButton>
          </Controls>
        )}
      </ReactFlow>
      <GraphContextMenu
        position={contextMenu}
        label={t('contextMenu')}
        onClose={() => setContextMenu(null)}
        finalFocus={canvas}
        actions={[
          { label: t('copy'), icon: Copy, onClick: () => { void commands.copy() }, disabled: selected.length === 0 },
          ...(!readOnly ? [
            { label: t('cut'), icon: Scissors, onClick: () => { void commands.copy(true) }, disabled: !canCut },
            { label: t('paste'), icon: ClipboardPaste, onClick: () => { void commands.paste(undefined, contextMenu?.target === 'pane' ? screenToFlowPosition(contextMenu) : undefined) }, disabled: !interactive },
          ] : []),
          ...(!readOnly && contextMenu && contextMenu.target !== 'relation' ? [
            { label: t('addConcept'), icon: Plus, onClick: () => { if (contextMenu.target === 'pane') addConceptAt(contextMenu); else handleAdd() }, disabled: !interactive },
          ] : []),
          ...(!readOnly && contextMenu && contextMenu.target !== 'pane' ? [
            { label: t('delete'), icon: Trash2, onClick: handleDelete, disabled: !canDelete },
          ] : []),
          { label: t('selectAll'), icon: ListChecks, onClick: selectAll, disabled: !interactive || viewCount === 0 },
          { label: t('fitView'), icon: Maximize, onClick: () => { void fitView(animatedFraming) } },
        ]}
      />
    </div>
  )
}
