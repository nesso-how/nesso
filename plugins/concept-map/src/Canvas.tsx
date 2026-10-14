import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Copy, ListChecks, Lock, LockOpen, Layers, Maximize, ClipboardPaste, Plus, Redo2, Scissors, Trash2, Undo2 } from 'lucide-react'
import type { RendererProps, Selection } from '@nesso/plugin'
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
import { conceptNode, conceptNodeMinSize, containsPoint, indexGraph, outsideEdge, outsideNode, relationEdge, type ConceptNodeSizes } from './adapters'
import type { ConceptNode, RelationEdge } from './types'
import { useNesso, usePluginContext } from './store'
import { copyGraph, isEditableTarget, pasteOperations } from './clipboard'
import { useIsCompact } from './media'
import { selectionCoversGraph, selectionForContextMenu, selectionFromChanges } from './selection'
import { useTranslation } from './i18n'

const nodeTypes: NodeTypes = { concept: ConceptNodeView }
const fitViewOptions = { padding: 0.3, maxZoom: 1.2 }
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const multiSelectionKeys = ['Meta', 'Control', 'Shift']
type ContextMenuTarget = Selection[number]['kind'] | 'pane' | 'selection'

export function Canvas({ readOnly = false, overlay, onDeleteView, conceptLabelMaxLength }: RendererProps) {
  const t = useTranslation()
  const graph = useNesso((state) => state.viewGraph)
  const indexed = useMemo(() => indexGraph(graph), [graph])
  const selected = useNesso((state) => state.selected)
  const fullGraph = useNesso((state) => state.graph)
  const conceptCount = fullGraph.concepts.length
  const defaultTypeId = useNesso((state) => state.vocabs.find((vocab) => vocab.id === state.preferences.activeVocabId)?.defaultTypeId)
  const view = useNesso((state) => state.workspace.activeViewId)
  const viewName = useNesso((state) => state.workspace.savedViews.find((saved) => saved.id === state.workspace.activeViewId)?.name) ?? t('completeGraph')
  const viewCount = graph.concepts.length
  const { store, notifications } = usePluginContext()
  const flow = useStoreApi()
  const readonly = useIsCompact() || readOnly
  const flowInteractive = useFlowStore((state) => state.nodesDraggable || state.nodesConnectable || state.elementsSelectable)
  const interactive = !readonly && flowInteractive
  const LockIcon = interactive ? LockOpen : Lock
  const [initialViewport] = useState(() => store.getState().workspace.viewports['concept-map'])
  const navigation = useRef(view)
  const reconnecting = useRef<RelationEdge | null>(null)
  const [reconnectDrag, setReconnectDrag] = useState(false)
  const dragGroup = useRef<string | undefined>(undefined)
  const canvas = useRef<HTMLDivElement>(null)
  const overlayElement = useRef<HTMLDivElement>(null)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const hasOverlay = Boolean(overlay)
  const framed = useRef(false)
  const framedGraph = useRef(graph)
  const width = useFlowStore((state) => state.width)
  const height = useFlowStore((state) => state.height)
  const nodesInitialized = useNodesInitialized()
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300
  const animatedFraming = { ...fitViewOptions, duration, ease: easeOut, interpolate: 'linear' as const }
  const pasted = useRef({ text: '', count: 0 })
  const paneSelection = useRef<Selection>([])
  const [editId, setEditId] = useState<string | null>(null)
  const { fitView, screenToFlowPosition, getNodes, getNodesBounds, setViewport } = useReactFlow()
  const zoom = useFlowStore((state) => state.transform[2])
  const [sizes, setSizes] = useState<ConceptNodeSizes>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null)
  const [outside, setOutside] = useState(false)
  const outsideActive = outside && view !== null

  const selectedConcepts = new Set(selected.filter((item) => item.kind === 'concept').map((item) => item.id))
  const selectedRelations = new Set(selected.filter((item) => item.kind === 'relation').map((item) => item.id))
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
  const nodes = [
    ...(outsideGraph?.concepts.map((concept) => outsideNode(concept, sizes[concept.id])) ?? []),
    ...graph.concepts.map((concept) => {
      const node = conceptNode(concept, selectedConcepts.has(concept.id), sizes[concept.id])
      return {
        ...node,
        data: {
          ...node.data,
          editable: interactive,
          maxLength: conceptLabelMaxLength,
          editing: interactive && editId === concept.id,
          onEditingChange: (editing: boolean) => setEditId((prev) => editing ? concept.id : (prev === concept.id ? null : prev)),
        },
      }
    }),
  ]
  const edges = [
    ...(outsideGraph?.relations.map((relation) => outsideEdge(relation, outsideGraph.indexed, defaultTypeId, sizes)) ?? []),
    ...graph.relations.map((relation) => ({
      ...relationEdge(relation, selectedRelations.has(relationKey(relation)), singleSelection, indexed, defaultTypeId, sizes),
      ariaLabel: t('relationFromTo', {
        source: indexed.concepts.get(relation.source)?.label ?? '',
        target: indexed.concepts.get(relation.target)?.label ?? '',
      }),
    })),
  ]

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

  const canDelete = selected.length > 0 && (!selectionCoversGraph(selected, graph) || Boolean(onDeleteView))
  const canCut = selected.length > 0 && selectedConcepts.size < conceptCount
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
    const id = store.addConcept(placement(), historyGroup)
    setEditId(id)
    requestAnimationFrame(() => {
      if (canvas.current === element) store.setConceptPosition(id, placement(), historyGroup)
    })
  }

  const removeSelected = () => {
    const { selected, graph } = store.getState()
    if (selected.filter((item) => item.kind === 'concept').length >= graph.concepts.length) return
    store.applyOperations(selected.map(({ kind, id }) => ({ kind: kind === 'concept' ? 'concept.remove' : 'relation.remove', id })))
  }

  const handleDelete = () => {
    const { selected, viewGraph } = store.getState()
    if (selectionCoversGraph(selected, viewGraph)) {
      setContextMenu(null)
      onDeleteView?.()
    } else removeSelected()
  }

  const selectAll = () => {
    const visible = store.getState().viewGraph
    store.setSelection([
      ...visible.concepts.map((concept) => ({ kind: 'concept' as const, id: concept.id })),
      ...visible.relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
    ])
  }

  const paste = (text: string, point?: { x: number; y: number }) => {
    const count = pasted.current.text === text ? pasted.current.count + 1 : 1
    try {
      store.applyOperations(pasteOperations(text, point ? screenToFlowPosition(point) : undefined, count * 40))
      pasted.current = { text, count }
      canvas.current?.focus()
    } catch {
      notifications.notify({ tone: 'warning', title: t('pasteFailed') })
    }
  }

  const copyToClipboard = async (cut = false, event?: ReactClipboardEvent<HTMLDivElement>) => {
    if (cut && (!interactive || !canCut)) return
    if (event && (isEditableTarget(event.target) || window.getSelection()?.isCollapsed === false)) return
    const before = store.getState()
    try {
      const text = copyGraph(before.graph, before.selected)
      if (!text) return
      if (event) {
        event.preventDefault()
        event.clipboardData.setData('text/plain', text)
      } else await navigator.clipboard.writeText(text)
      const state = store.getState()
      if (cut && flow.getState().elementsSelectable && state.graph === before.graph && state.selected === before.selected) removeSelected()
    } catch {
      notifications.notify({ tone: 'warning', title: t('clipboardUnavailable') })
    }
  }

  const pasteFromClipboard = async (point?: { x: number; y: number }) => {
    const view = store.getState().workspace.activeViewId
    try {
      const text = await navigator.clipboard.readText()
      const state = flow.getState()
      if (store.getState().workspace.activeViewId === view && !readonly
        && (state.nodesDraggable || state.nodesConnectable || state.elementsSelectable)) paste(text, point)
    } catch {
      notifications.notify({ tone: 'warning', title: t('clipboardUnavailable') })
    }
  }

  const addConceptAt = (point: { x: number; y: number }, selection = store.getState().selected) => {
    const position = screenToFlowPosition(point)
    const id = newIri()
    store.applyOperations([
      { kind: 'selection.set', value: selection },
      { kind: 'concept.add', id, position: { x: position.x - conceptNodeMinSize.width / 2, y: position.y - conceptNodeMinSize.height / 2 } },
    ])
    setEditId(id)
  }

  const openContextMenu = (point: { x: number; y: number }, item?: Selection[number], target: ContextMenuTarget = item?.kind ?? 'pane') => {
    if (interactive && item) store.setSelection(selectionForContextMenu(store.getState().selected, item))
    setContextMenu({ ...point, target })
  }

  const handleContextMenu = (event: Pick<ReactMouseEvent, 'preventDefault' | 'clientX' | 'clientY'>, item?: Selection[number], target?: ContextMenuTarget) => {
    if (readOnly) return
    event.preventDefault()
    openContextMenu({ x: event.clientX, y: event.clientY }, item, target)
  }

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
    if (hasOverlay || navigation.current === view) return
    navigation.current = view
    setContextMenu(null)
    const frame = requestAnimationFrame(() => {
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
    const element = overlayElement.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setOverlayHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasOverlay])

  useEffect(() => {
    if (!hasOverlay || !overlayHeight || !nodesInitialized || !width || !height) return
    const panel = overlayElement.current!.parentElement!
    const margin = parseFloat(getComputedStyle(panel).marginBottom)
    const viewport = getViewportForBounds(getNodesBounds(getNodes()), width, Math.max(1, height - overlayHeight - margin), 0.2, 1.2, '40px')
    const changed = framedGraph.current !== graph
    framedGraph.current = graph
    const animate = framed.current && changed
    void setViewport(viewport, animate ? { duration, ease: easeOut, interpolate: 'linear' } : { duration: 0 })
    framed.current = true
  }, [hasOverlay, overlayHeight, nodesInitialized, width, height, graph, getNodes, getNodesBounds, setViewport, duration])

  return (
    <div ref={canvas} tabIndex={0} className={reconnectDrag ? 'h-full w-full outline-none graph-reconnecting' : 'h-full w-full outline-none'} onCopy={(event) => { void copyToClipboard(false, event) }} onCut={(event) => { void copyToClipboard(true, event) }} onPaste={(event) => {
      if (!interactive || isEditableTarget(event.target)) return
      event.preventDefault()
      paste(event.clipboardData.getData('text/plain'))
    }} onKeyDown={(event) => {
      if (isEditableTarget(event.target)) return
      if (readOnly) {
        if (event.key === 'Escape') clearSelection()
        return
      }
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        openKeyboardContextMenu(event.target as Element)
        return
      }
      if (contextMenu) return
      if (event.key === 'Escape') clearSelection()
      if (!interactive) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDelete()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
      }
    }}>
      <ReactFlow
        className={hasOverlay ? 'graph-presentation' : undefined}
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
        edgesReconnectable={interactive}
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
        onPaneClick={(event) => {
          if (event.detail === 1) paneSelection.current = store.getState().selected
          clearSelection()
          canvas.current?.focus()
        }}
        onPaneContextMenu={(event) => handleContextMenu(event)}
        onNodeContextMenu={(event, node) => handleContextMenu(event, { kind: 'concept', id: node.id })}
        onEdgeContextMenu={(event, edge) => handleContextMenu(event, { kind: 'relation', id: edge.id })}
        onSelectionContextMenu={(event) => handleContextMenu(event, undefined, 'selection')}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        connectionLineComponent={ConnectionPreview}
        connectionLineStyle={{ stroke: 'var(--handle)', strokeWidth: 1.2, strokeDasharray: '4 4' }}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveStart={() => setContextMenu(null)}
        onMoveEnd={readOnly ? undefined : (_event, viewport) => store.setViewport('concept-map', viewport)}
        fitView={!initialViewport && !hasOverlay}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
      >
        {overlay ? <Panel position="bottom-left" className="canvas-overlay"><div ref={overlayElement}>{overlay}</div></Panel>
          : <Panel position="top-left" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground">{viewName} · {t('conceptCount', { count: viewCount })}</Panel>}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--node-border)" />
        {!overlay && (
          <Controls showZoom={false} showFitView={false} showInteractive={false} orientation="horizontal">
            <ControlButton className="react-flow__controls-fitview" onClick={() => { void fitView(animatedFraming) }} title={t('fitView')} aria-label={t('fitView')}>
              <Maximize aria-hidden="true" />
            </ControlButton>
            {!readonly && (
              <>
                <ControlButton className="react-flow__controls-interactive" onClick={() => flow.setState({ nodesDraggable: !interactive, nodesConnectable: !interactive && singleSelection, elementsSelectable: !interactive })} title={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-label={t(interactive ? 'lockInteractions' : 'unlockInteractions')} aria-pressed={!interactive}>
                  <LockIcon aria-hidden="true" />
                </ControlButton>
                <ControlButton className="react-flow__controls-outside" onClick={toggleOutside} disabled={view === null} title={outsideLabel} aria-label={outsideLabel} aria-pressed={outsideActive}>
                  <Layers aria-hidden="true" />
                </ControlButton>
              </>
            )}
          </Controls>
        )}
        {!overlay && <Panel position="bottom-right" className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground" aria-label={t('zoomLevel')}>{Math.round(zoom * 100)}%</Panel>}
        {!readonly && (
          <Controls position="top-right" orientation="horizontal" showZoom={false} showFitView={false} showInteractive={false}>
            <ControlButton onClick={store.undo} disabled={!canUndo} title={t('undo')} aria-label={t('undo')}>
              <Undo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={store.redo} disabled={!canRedo} title={t('redo')} aria-label={t('redo')}>
              <Redo2 aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void copyToClipboard() }} disabled={selected.length === 0} title={t('copy')} aria-label={t('copy')}>
              <Copy aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void copyToClipboard(true) }} disabled={!interactive || !canCut} title={t('cut')} aria-label={t('cut')}>
              <Scissors aria-hidden="true" />
            </ControlButton>
            <ControlButton onClick={() => { void pasteFromClipboard() }} disabled={!interactive} title={t('paste')} aria-label={t('paste')}>
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
          { label: t('copy'), icon: Copy, onClick: () => { void copyToClipboard() }, disabled: selected.length === 0 },
          ...(!readonly ? [
            { label: t('cut'), icon: Scissors, onClick: () => { void copyToClipboard(true) }, disabled: !interactive || !canCut },
            { label: t('paste'), icon: ClipboardPaste, onClick: () => { void pasteFromClipboard(contextMenu?.target === 'pane' ? contextMenu : undefined) }, disabled: !interactive },
          ] : []),
          ...(!readonly && contextMenu && contextMenu.target !== 'relation' ? [
            { label: t('addConcept'), icon: Plus, onClick: () => { if (contextMenu.target === 'pane') addConceptAt(contextMenu); else handleAdd() }, disabled: !interactive },
          ] : []),
          ...(!readonly && contextMenu && contextMenu.target !== 'pane' ? [
            { label: t('delete'), icon: Trash2, onClick: handleDelete, disabled: !interactive || !canDelete },
          ] : []),
          { label: t('selectAll'), icon: ListChecks, onClick: selectAll, disabled: !interactive || viewCount === 0 },
          { label: t('fitView'), icon: Maximize, onClick: () => { void fitView(animatedFraming) } },
        ]}
      />
    </div>
  )
}
