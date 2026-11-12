import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import {
  Bold,
  Copy,
  Italic,
  ListChecks,
  ListPlus,
  Lock,
  LockOpen,
  Group,
  Maximize,
  Network,
  ClipboardPaste,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react'
import type { Selection } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
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
  type ConnectionLineComponentProps,
  type NodeChange,
  type NodeTypes,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './styles.css'
import { newIri, relationKey } from '@nesso-how/schema'
import { ConceptNodeView } from './ConceptNodeView'
import { GroupNodeView } from './GroupNodeView'
import { arrange, type LayoutBounds } from './layout'
import { groupRelations, keepGroups } from './groups'
import type { RelationGroup } from './groups'
import { ConnectionPreview } from './ConnectionPreview'
import { GraphContextMenu } from './GraphContextMenu'
import {
  createGraphElements,
  conceptBoxes,
  conceptNodeMinSize,
  estimatedSize,
  indexGraph,
  type ConceptNodeSizes,
} from './adapters'
import { presentedGraph, type ConceptNode, type RelationEdge } from './types'
import { useNesso, useCanvasContext, type CanvasProps } from './store'
import { selectionForContextMenu, selectionFromChanges } from './selection'
import { useTranslation } from './i18n'
import { reconnectOperations, selectedRelations, type Reconnection } from './reconnection'
import { canConnect } from './connection'

const nodeTypes: NodeTypes = {
  concept: ConceptNodeView,
  relationGroup: GroupNodeView,
}
const fitViewOptions = { padding: 0.3, maxZoom: 1.2 }
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const multiSelectionKeys = ['Meta', 'Control', 'Shift']
type ContextMenuTarget = Selection[number]['kind'] | 'pane' | 'selection'

function ZoomLevel({
  target,
  visible,
}: {
  target: RefObject<HTMLDivElement | null>
  visible: boolean
}) {
  const t = useTranslation()
  const zoom = useFlowStore((state) => state.transform[2])
  useLayoutEffect(() => {
    target.current?.style.setProperty('--graph-zoom', String(zoom))
  }, [target, zoom])
  if (!visible) return null
  return (
    <Panel
      position="bottom-right"
      className="canvas-label pointer-events-none font-mono text-[10px] text-muted-foreground select-none"
      aria-label={t('zoomLevel')}
    >
      {Math.round(zoom * 100)}%
    </Panel>
  )
}

export function Canvas({
  onPresentation,
  ref,
  readOnly = false,
  preview = false,
  bottomInset = 0,
  conceptLabelMaxLength,
  focusRef: canvas,
}: CanvasProps) {
  const t = useTranslation()
  const graph = useNesso(presentedGraph)
  const vocabs = useNesso((state) => state.vocabs)
  const locale = useNesso((state) => state.preferences.locale ?? defaultLocale)
  const dragPositions = useRef<ReadonlyMap<string, XYPosition> | null>(null)
  const [dragged, setDragged] = useState<ReadonlyMap<string, XYPosition> | null>(null)
  const displayed = useMemo(
    () =>
      dragged
        ? {
            ...graph,
            concepts: graph.concepts.map((concept) => {
              const position = dragged.get(concept.id)
              return position ? { ...concept, position } : concept
            }),
          }
        : graph,
    [graph, dragged],
  )
  const indexed = useMemo(() => indexGraph(displayed, vocabs, locale), [displayed, vocabs, locale])
  const selected = useNesso((state) => state.selected)
  const conceptCount = useNesso((state) => state.graph.concepts.length)
  const view = useNesso((state) => state.workspace.activeViewId)
  const defaultTypeId = useNesso(
    (state) => state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)?.defaultTypeId,
  )
  const viewCount = graph.concepts.length
  const { store, commands, connection } = useCanvasContext()
  const write = store.applyOperations
  const flow = useStoreApi()
  const [locked, setLocked] = useState(false)
  const interactive = !readOnly && !locked
  const LockIcon = interactive ? LockOpen : Lock
  const [initialViewport] = useState(() => store.getState().workspace.viewports['concept-map'])
  const navigation = useRef(view)
  const reconnecting = useRef<Reconnection | null>(null)
  const [reconnectDrag, setReconnectDrag] = useState<Reconnection | null>(null)
  const hasOverlay = preview
  const selectable = interactive || hasOverlay || readOnly
  const framed = useRef(false)
  const framedGraph = useRef(graph)
  const width = useFlowStore((state) => state.width)
  const height = useFlowStore((state) => state.height)
  const nodesInitialized = useNodesInitialized()
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300
  const animatedFraming = useMemo(
    () => ({ ...fitViewOptions, duration, ease: easeOut, interpolate: 'linear' as const }),
    [duration],
  )
  const paneSelection = useRef<Selection>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  const {
    fitView,
    screenToFlowPosition,
    getNodes,
    getNodesBounds,
    setViewport,
    setCenter,
    getZoom,
  } = useReactFlow()
  const userSelecting = useFlowStore((state) => state.userSelectionActive)
  const [sizes, setSizes] = useState<ConceptNodeSizes>({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: ContextMenuTarget
  } | null>(null)
  const grouping = useNesso((state) => state.preferences.relationGroups ?? true)
  const [retained, setRetained] = useState({ view, grouping, groups: [] as RelationGroup[] })
  const kept = useMemo(
    () =>
      keepGroups(retained.view === view && retained.grouping === grouping ? retained.groups : []),
    [retained, view, grouping],
  )
  const [adapt] = useState(createGraphElements)
  const selection = useCallback(
    (value: Selection) => {
      write([{ kind: 'selection.set', value }])
    },
    [write],
  )
  const ariaLabelConfig = useMemo(
    () => ({
      'node.a11yDescription.default': t('nodeSelectionInstructions'),
      'edge.a11yDescription.default': t('relationInstructions'),
      'controls.ariaLabel': t('controls'),
      'controls.fitView.ariaLabel': t('fitView'),
      'controls.interactive.ariaLabel': t('toggleInteractions'),
    }),
    [t],
  )

  const singleSelection = selected.length === 1
  const groups = useMemo(
    () =>
      grouping
        ? groupRelations({
            concepts: displayed.concepts,
            relations: displayed.relations,
            sizes,
            kept,
          })
        : [],
    [grouping, displayed, sizes, kept],
  )
  if (
    retained.view !== view ||
    retained.grouping !== grouping ||
    retained.groups.length !== groups.length ||
    retained.groups.some((group, index) => group.key !== groups[index].key)
  )
    setRetained({ view, grouping, groups })
  useLayoutEffect(() => {
    if (dragged) return
    onPresentation?.({
      graph,
      viewId: view,
      groups: groups.filter((group) => {
        const count = group.relations.filter((id) =>
          selected.some((item) => item.kind === 'relation' && item.id === id),
        ).length
        return count === 0 || count === group.relations.length
      }),
    })
  }, [groups, dragged, onPresentation, graph, view, sizes, selected])
  const groupDrag = useRef<{
    pointerId: number
    members: readonly string[]
    origin: XYPosition
    moved: boolean
  } | null>(null)
  const selectGroup = useCallback(
    (members: readonly string[]) => {
      if (!selectable) return
      selection(members.map((id) => ({ kind: 'concept', id })))
    },
    [selection, selectable],
  )
  const moveGroup = useCallback(
    (members: readonly string[], delta: XYPosition, done: boolean) => {
      const positions = new Map(
        presentedGraph(store.getState())
          .concepts.filter(({ id }) => members.includes(id))
          .map(({ id, position }) => [id, { x: position.x + delta.x, y: position.y + delta.y }]),
      )
      if (done) {
        write([
          {
            kind: 'concept.positions',
            updates: [...positions].map(([id, position]) => ({ id, position })),
          },
        ])
        dragPositions.current = null
        setDragged(null)
      } else {
        dragPositions.current = positions
        setDragged(positions)
      }
    },
    [store, write],
  )
  const cancelGroupDrag = () => {
    if (!groupDrag.current) return
    groupDrag.current = null
    dragPositions.current = null
    setDragged(null)
  }
  const visibleBounds = useCallback((): LayoutBounds => {
    const {
      transform: [x, y, zoom],
      width,
      height,
    } = flow.getState()
    const inset = 24 / zoom
    return {
      x: inset - x / zoom,
      y: inset - y / zoom,
      width: width / zoom - 2 * inset,
      height: height / zoom - 2 * inset,
    }
  }, [flow])
  const viewportPosition = useCallback(
    (position?: XYPosition) => {
      const bounds = visibleBounds()
      const maxX = Math.max(bounds.x, bounds.x + bounds.width - conceptNodeMinSize.width)
      const maxY = Math.max(bounds.y, bounds.y + bounds.height - conceptNodeMinSize.height)
      const { x, y } = position ?? { x: (bounds.x + maxX) / 2, y: (bounds.y + maxY) / 2 }
      return {
        x: Math.max(bounds.x, Math.min(x, maxX)),
        y: Math.max(bounds.y, Math.min(y, maxY)),
      }
    },
    [visibleBounds],
  )
  const addNear = useCallback(
    (id: string) => {
      const state = store.getState()
      const viewId = state.workspace.activeViewId
      if (!viewId) return
      const { concepts: members, relations: shown } = presentedGraph(state)
      const ids = new Set(members.map((concept) => concept.id))
      const links = state.graph.relations.filter(
        ({ source, target }) =>
          (source === id && ids.has(target)) || (target === id && ids.has(source)),
      )
      const label = state.graph.concepts.find((concept) => concept.id === id)?.label ?? ''
      const position =
        links.length === 0
          ? viewportPosition()
          : arrange({
              fixed: conceptBoxes(members, sizes),
              free: [{ id, ...estimatedSize(label, sizes, id) }],
              links: [...shown, ...links],
            }).get(id)!
      write([
        { kind: 'view.membership', viewId, conceptId: id, included: true },
        { kind: 'concept.position', id, value: position },
      ])
    },
    [store, sizes, viewportPosition, write],
  )
  useImperativeHandle(
    ref,
    () => ({
      focusConcept: setFocusTarget,
      addToView: (id) => {
        if (!presentedGraph(store.getState()).concepts.some((concept) => concept.id === id))
          addNear(id)
      },
    }),
    [store, addNear],
  )
  const elements = adapt({
    groups,
    preview: new Set(
      dragged
        ? groups
            .filter(
              (group) => dragged.has(group.anchor) || group.members.some((id) => dragged.has(id)),
            )
            .map(({ key }) => key)
        : [],
    ),
    onGroupSelect: selectGroup,
    graph: displayed,
    indexed,
    selected,
    sizes,
    defaultTypeId,
    editing: {
      id: editId,
      enabled: interactive,
      maxLength: conceptLabelMaxLength,
      onChange: setEditId,
    },
    label: (relation) =>
      t('relationFromTo', {
        source: indexed.concepts.get(relation.source)?.label ?? '',
        target: indexed.concepts.get(relation.target)?.label ?? '',
      }),
  })
  const nodes = elements.nodes
  const edges = useMemo(() => {
    if (!reconnectDrag) return elements.edges
    const ids = new Set(reconnectDrag.relations.map(relationKey))
    return elements.edges.map((edge) =>
      ids.has(edge.id) || edge.data?.relations?.some((id) => ids.has(id))
        ? { ...edge, className: 'graph-reconnecting-edge' }
        : edge,
    )
  }, [elements.edges, reconnectDrag])
  const connectionPreview = useCallback(
    (props: ConnectionLineComponentProps) => (
      <ConnectionPreview {...props} reconnection={reconnectDrag} />
    ),
    [reconnectDrag],
  )

  const onObjectChanges = useCallback(
    (
      kind: 'concept' | 'relation',
      changes: (NodeChange<ConceptNode> | EdgeChange<RelationEdge>)[],
    ) => {
      const state = store.getState()
      const current = state.selected
      const next = selectionFromChanges(current, kind, changes)
      if (next !== current) selection(next)
    },
    [store, selection],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<ConceptNode>[]) => {
      const concepts = changes.filter(
        (change) => !('id' in change) || !change.id.startsWith('#group:'),
      )
      const dimensions = concepts.flatMap((change) =>
        change.type === 'dimensions' && change.dimensions
          ? [{ id: change.id, size: change.dimensions }]
          : [],
      )
      if (dimensions.length)
        setSizes((previous) => {
          const next = { ...previous }
          for (const change of dimensions) next[change.id] = change.size
          return next
        })
      const moves = concepts.flatMap((change) =>
        change.type === 'position' && change.position
          ? [{ id: change.id, position: change.position, dragging: change.dragging }]
          : [],
      )
      if (!readOnly && moves.length) {
        const positions = new Map(dragPositions.current)
        for (const { id, position } of moves) positions.set(id, position)
        if (moves.some(({ dragging }) => dragging)) {
          dragPositions.current = positions
          setDragged(positions)
        } else {
          dragPositions.current = null
          const existing = new Set(store.getState().graph.concepts.map(({ id }) => id))
          write([
            {
              kind: 'concept.positions',
              updates: [...positions]
                .filter(([id]) => existing.has(id))
                .map(([id, position]) => ({ id, position })),
            },
          ])
          setDragged(null)
        }
      }
      onObjectChanges('concept', concepts)
    },
    [readOnly, store, write, onObjectChanges],
  )

  const cancelConnection = () => {
    reconnecting.current = null
    setReconnectDrag(null)
    flow.getState().cancelConnection()
    flow.setState({ connectionClickStartHandle: null })
  }

  useEffect(() => {
    flow.getState().cancelConnection()
    flow.setState({ connectionClickStartHandle: null })
  }, [connection, view, flow])

  const canDelete = interactive && selected.length > 0
  const canCut =
    canDelete && selected.filter(({ kind }) => kind === 'concept').length < conceptCount
  const selectedConcepts = graph.concepts.filter((concept) =>
    selected.some(({ kind, id }) => kind === 'concept' && id === concept.id),
  )
  const allBold = selectedConcepts.length > 0 && selectedConcepts.every((concept) => concept.bold)
  const allItalic =
    selectedConcepts.length > 0 && selectedConcepts.every((concept) => concept.italic)
  const canEmphasize = interactive && selectedConcepts.length > 0
  const toggleBold = () => {
    if (!canEmphasize) return
    write(selectedConcepts.map(({ id }) => ({ kind: 'concept.bold', id, value: !allBold })))
  }
  const toggleItalic = () => {
    if (!canEmphasize) return
    write(selectedConcepts.map(({ id }) => ({ kind: 'concept.italic', id, value: !allItalic })))
  }
  const emphasizeModifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const canUndo = useNesso((state) => state.history.canUndo)
  const canRedo = useNesso((state) => state.history.canRedo)

  const handleAdd = () => {
    const element = canvas.current
    if (!element) return
    const state = store.getState()
    const source =
      state.selected.length === 1 && state.selected[0].kind === 'concept'
        ? presentedGraph(state).concepts.find((concept) => concept.id === state.selected[0].id)
        : undefined
    const placement = () =>
      viewportPosition(
        source && {
          x: source.position.x + store.conceptPlacementOffset.x,
          y: source.position.y + store.conceptPlacementOffset.y,
        },
      )
    const historyGroup = newIri()
    const id = newIri()
    write([{ kind: 'concept.add', id, position: placement() }], { historyGroup })
    setEditId(id)
    requestAnimationFrame(() => {
      const current = store.getState()
      if (
        canvas.current === element &&
        current.workspace.activeViewId === state.workspace.activeViewId &&
        current.graph.concepts.some((concept) => concept.id === id)
      )
        write([{ kind: 'concept.position', id, value: placement() }], { historyGroup })
    })
  }

  const canRearrange = interactive && (selectedConcepts.length > 0 || viewCount > 1)
  const rearrangeLabel = t(selectedConcepts.length > 0 ? 'rearrangeSelection' : 'rearrangeView')
  const rearrange = () => {
    const { concepts, relations } = presentedGraph(store.getState())
    const chosen = new Set(selectedConcepts.map(({ id }) => id))
    const moving = ({ id }: { id: string }) => chosen.size === 0 || chosen.has(id)
    const boxes = conceptBoxes(concepts, sizes)
    const positions = arrange({
      fixed: boxes.filter((box) => !moving(box)),
      free: boxes.filter(moving),
      links: relations,
    })
    write([
      {
        kind: 'concept.positions',
        updates: [...positions].map(([id, position]) => ({ id, position })),
      },
    ])
  }

  const handleDelete = () => {
    setContextMenu(null)
    commands.deleteSelection()
  }

  const selectAll = () => {
    const { viewGraph } = store.getState()
    selection([
      ...viewGraph.concepts.map(({ id }) => ({ kind: 'concept' as const, id })),
      ...viewGraph.relations.map((relation) => ({
        kind: 'relation' as const,
        id: relationKey(relation),
      })),
    ])
  }

  const addConceptAt = (point: { x: number; y: number }, selection = store.getState().selected) => {
    const position = screenToFlowPosition(point)
    const id = newIri()
    write([
      { kind: 'selection.set', value: selection },
      {
        kind: 'concept.add',
        id,
        position: {
          x: position.x - conceptNodeMinSize.width / 2,
          y: position.y - conceptNodeMinSize.height / 2,
        },
      },
    ])
    setEditId(id)
  }

  const openContextMenu = useCallback(
    (
      point: { x: number; y: number },
      item?: Selection[number],
      target: ContextMenuTarget = item?.kind ?? 'pane',
    ) => {
      if (interactive && item) selection(selectionForContextMenu(store.getState().selected, item))
      setContextMenu({ ...point, target })
    },
    [interactive, selection, store],
  )

  const handleContextMenu = useCallback(
    (
      event: Pick<ReactMouseEvent, 'preventDefault' | 'clientX' | 'clientY'>,
      item?: Selection[number],
      target?: ContextMenuTarget,
    ) => {
      if (readOnly) return
      event.preventDefault()
      openContextMenu({ x: event.clientX, y: event.clientY }, item, target)
    },
    [readOnly, openContextMenu],
  )
  const objectHandlers = useMemo(
    () => ({
      onNodeContextMenu: (event: ReactMouseEvent, node: ConceptNode) => {
        if (node.type === 'relationGroup') {
          if (interactive) selectGroup(node.data.members!)
          handleContextMenu(event, undefined, 'selection')
        } else handleContextMenu(event, { kind: 'concept', id: node.id })
      },
      onEdgeContextMenu: (event: ReactMouseEvent, edge: RelationEdge) => {
        if (edge.data?.relations) {
          if (interactive) selection(edge.data.relations.map((id) => ({ kind: 'relation', id })))
          handleContextMenu(event, undefined, 'relation')
        } else handleContextMenu(event, { kind: 'relation', id: edge.id })
      },
      onReconnect: interactive
        ? (_edge: RelationEdge, connection: { source: string; target: string }) => {
            const reconnect = reconnecting.current
            if (!reconnect) return
            const operations = reconnectOperations(
              store.getState().graph,
              reconnect,
              connection[reconnect.endpoint],
            )
            if (operations.length) write(operations)
          }
        : undefined,
      onReconnectStart: (_event: unknown, _edge: RelationEdge, handleType: 'source' | 'target') => {
        const state = store.getState()
        reconnecting.current = {
          relations: selectedRelations(state.viewGraph, state.selected),
          endpoint: handleType === 'source' ? 'target' : 'source',
        }
        setReconnectDrag(reconnecting.current)
      },
      onReconnectEnd: () => {
        reconnecting.current = null
        setReconnectDrag(null)
      },
    }),
    [handleContextMenu, interactive, write, store, selection, selectGroup],
  )

  const handlePaneDoubleClick = (event: ReactMouseEvent) => {
    if (!interactive) return
    const target = event.target as HTMLElement | null
    if (
      target?.closest?.(
        '.react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__panel, button',
      )
    )
      return
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
    const prevent = (event: Event) => {
      const target = event.target
      if (
        target instanceof Element &&
        canvas.current?.contains(target) &&
        !target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      )
        event.preventDefault()
    }
    document.addEventListener('selectstart', prevent)
    return () => document.removeEventListener('selectstart', prevent)
  }, [canvas])

  useEffect(() => {
    if (!userSelecting) return
    window.getSelection()?.removeAllRanges()
    const prevent = (event: Event) => event.preventDefault()
    document.addEventListener('selectstart', prevent)
    return () => document.removeEventListener('selectstart', prevent)
  }, [userSelecting])

  useEffect(() => {
    if (hasOverlay || navigation.current === view) return
    navigation.current = view
    if (focusTarget) return
    const frame = requestAnimationFrame(() => {
      setContextMenu(null)
      void fitView(animatedFraming)
    })
    return () => cancelAnimationFrame(frame)
  }, [view, fitView, hasOverlay, animatedFraming, focusTarget])

  useEffect(() => {
    if (!focusTarget || !nodesInitialized || !width || !height) return
    const frame = requestAnimationFrame(() => {
      if (graph.concepts.some(({ id }) => id === focusTarget)) {
        if (bottomInset > 0) {
          const bounds = getNodesBounds([focusTarget])
          const zoom = getZoom()
          void setCenter(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2 + bottomInset / 2 / zoom,
            { zoom, duration, ease: easeOut, interpolate: 'linear' },
          )
        } else {
          void fitView({ ...animatedFraming, nodes: [{ id: focusTarget }] })
          canvas.current?.focus()
        }
      }
      setFocusTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [
    focusTarget,
    nodesInitialized,
    graph,
    width,
    height,
    fitView,
    animatedFraming,
    canvas,
    bottomInset,
    getNodesBounds,
    getZoom,
    setCenter,
    duration,
  ])

  useEffect(() => {
    if (!hasOverlay || !nodesInitialized || !width || !height) return
    const viewport = getViewportForBounds(
      getNodesBounds(getNodes()),
      width,
      Math.max(1, height - bottomInset),
      0.2,
      1.2,
      '40px',
    )
    const changed = framedGraph.current !== graph
    framedGraph.current = graph
    const animate = framed.current && changed
    void setViewport(
      viewport,
      animate ? { duration, ease: easeOut, interpolate: 'linear' } : { duration: 0 },
    )
    framed.current = true
  }, [
    hasOverlay,
    bottomInset,
    nodesInitialized,
    width,
    height,
    graph,
    getNodes,
    getNodesBounds,
    setViewport,
    duration,
  ])

  return (
    <div
      ref={canvas}
      tabIndex={0}
      className={
        reconnectDrag
          ? 'h-full w-full outline-none graph-reconnecting'
          : 'h-full w-full outline-none'
      }
      onPointerDown={(event) => {
        if (
          selectable &&
          !groupDrag.current &&
          event.button === 0 &&
          event.target instanceof Element &&
          event.target.closest('.relation-group')
        ) {
          const id = event.target.closest('.react-flow__node')?.getAttribute('data-id')
          const group = groups.find((group) => `#group:${group.key}` === id)
          if (group) {
            event.currentTarget.setPointerCapture(event.pointerId)
            groupDrag.current = {
              pointerId: event.pointerId,
              members: group.members,
              origin: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
              moved: false,
            }
          }
        }
        if (
          event.shiftKey &&
          event.target instanceof Element &&
          !event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          )
        )
          window.getSelection()?.removeAllRanges()
      }}
      onPointerMove={(event) => {
        const drag = groupDrag.current
        if (!drag || drag.pointerId !== event.pointerId || !interactive) return
        const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        const delta = { x: point.x - drag.origin.x, y: point.y - drag.origin.y }
        if (!drag.moved && Math.hypot(delta.x, delta.y) < 3) return
        drag.moved = true
        moveGroup(drag.members, delta, false)
      }}
      onPointerUp={(event) => {
        const drag = groupDrag.current
        if (!drag || drag.pointerId !== event.pointerId) return
        cancelGroupDrag()
        if (!drag.moved) selectGroup(drag.members)
        else if (interactive) {
          const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
          moveGroup(drag.members, { x: point.x - drag.origin.x, y: point.y - drag.origin.y }, true)
        }
      }}
      onPointerCancel={cancelGroupDrag}
      onLostPointerCapture={cancelGroupDrag}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing) return
        if (
          event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          )
        )
          return
        if (contextMenu) {
          event.stopPropagation()
          return
        }
        if (
          !readOnly &&
          !hasOverlay &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'g'
        ) {
          event.preventDefault()
          write([{ kind: 'preferences.relationGroups', value: !grouping }])
          return
        }
        if (
          canRearrange &&
          !hasOverlay &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'l'
        ) {
          event.preventDefault()
          if (!event.repeat) rearrange()
          return
        }
        if (
          !hasOverlay &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'f'
        ) {
          event.preventDefault()
          void fitView(animatedFraming)
          return
        }
        if (event.key === 'Escape') {
          const state = flow.getState()
          if (
            state.connection.inProgress ||
            state.connectionClickStartHandle ||
            reconnecting.current
          ) {
            cancelConnection()
            event.preventDefault()
          }
        }
        if (readOnly) return
        if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && !hasOverlay) {
          const key = event.key.toLowerCase()
          if (key === 'b' || key === 'i') {
            if (!interactive || !canEmphasize || event.repeat) return
            event.preventDefault()
            if (key === 'b') toggleBold()
            else toggleItalic()
            return
          }
        }
        if (
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key === 'Enter' &&
          interactive &&
          !(event.target instanceof Element && event.target.closest('button'))
        ) {
          const current = store.getState().selected
          if (current.length === 1 && current[0].kind === 'concept') {
            event.preventDefault()
            setEditId(current[0].id)
            return
          }
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        ariaLabelConfig={ariaLabelConfig}
        nodesDraggable={interactive}
        elementsSelectable={selectable}
        defaultEdgeOptions={{ selectable: !readOnly || hasOverlay }}
        nodesConnectable={!!connection || (interactive && (singleSelection || !!reconnectDrag))}
        edgesReconnectable={interactive}
        multiSelectionKeyCode={multiSelectionKeys}
        deleteKeyCode={null}
        disableKeyboardA11y
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) =>
          onObjectChanges(
            'relation',
            changes.flatMap((change) => {
              const group =
                'id' in change
                  ? groups.find((group) => `#group:${group.key}` === change.id)
                  : undefined
              return group && change.type === 'select'
                ? group.relations.map((id) => ({ ...change, id }))
                : [change]
            }),
          )
        }
        onConnect={
          interactive || connection
            ? ({ source, target }) => {
                if (!canConnect(store.getState().graph, source, target, defaultTypeId, connection))
                  return
                write([{ kind: 'relation.connect', source, target }])
              }
            : undefined
        }
        {...objectHandlers}
        reconnectRadius={5}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={({ source, target }) => {
          const graph = store.getState().graph
          const reconnect = reconnecting.current
          if (reconnect)
            return (
              reconnectOperations(
                graph,
                reconnect,
                reconnect.endpoint === 'source' ? source : target,
              ).length > 0
            )
          return canConnect(graph, source, target, defaultTypeId, connection)
        }}
        onPaneClick={(event) => {
          if (event.detail === 1) paneSelection.current = store.getState().selected
          cancelConnection()
          selection([])
          canvas.current?.focus()
        }}
        onPaneContextMenu={(event) => handleContextMenu(event)}
        onSelectionStart={() => window.getSelection()?.removeAllRanges()}
        onSelectionContextMenu={(event) => handleContextMenu(event, undefined, 'selection')}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        connectionLineComponent={connectionPreview}
        connectionLineStyle={{ stroke: 'var(--handle)', strokeWidth: 1.2, strokeDasharray: '4 4' }}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        defaultViewport={initialViewport}
        onMoveStart={() => setContextMenu(null)}
        onMoveEnd={
          readOnly
            ? undefined
            : (_event, value) => {
                write([{ kind: 'viewport.set', rendererId: 'concept-map', value }])
              }
        }
        fitView={!initialViewport && !hasOverlay}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="var(--node-border)"
        />
        {!hasOverlay && (
          <Controls
            showZoom={false}
            showFitView={false}
            showInteractive={false}
            orientation="horizontal"
          >
            <ControlButton
              className="react-flow__controls-fitview"
              onClick={() => {
                void fitView(animatedFraming)
              }}
              title={`${t('fitView')} (F)`}
              aria-label={t('fitView')}
              aria-keyshortcuts="f"
            >
              <Maximize aria-hidden="true" />
            </ControlButton>
            {!readOnly && (
              <>
                <ControlButton
                  className="react-flow__controls-interactive"
                  onClick={() => setLocked((value) => !value)}
                  title={t(interactive ? 'lockInteractions' : 'unlockInteractions')}
                  aria-label={t(interactive ? 'lockInteractions' : 'unlockInteractions')}
                  aria-pressed={!interactive}
                >
                  <LockIcon aria-hidden="true" />
                </ControlButton>
                <ControlButton
                  onClick={() => write([{ kind: 'preferences.relationGroups', value: !grouping }])}
                  title={`${t(grouping ? 'ungroupRelations' : 'groupRelations')} (G)`}
                  aria-label={t(grouping ? 'ungroupRelations' : 'groupRelations')}
                  aria-keyshortcuts="g"
                  aria-pressed={grouping}
                >
                  <Group aria-hidden="true" />
                </ControlButton>
                <ControlButton
                  onClick={rearrange}
                  disabled={!canRearrange}
                  title={`${rearrangeLabel} (L)`}
                  aria-label={rearrangeLabel}
                  aria-keyshortcuts="l"
                >
                  <Network aria-hidden="true" />
                </ControlButton>
              </>
            )}
          </Controls>
        )}
        <ZoomLevel target={canvas} visible={!hasOverlay} />
        {!readOnly && (
          <>
            <Controls
              position="top-left"
              orientation="horizontal"
              showZoom={false}
              showFitView={false}
              showInteractive={false}
            >
              <ControlButton
                onClick={store.undo}
                disabled={!canUndo}
                title={t('undo')}
                aria-label={t('undo')}
              >
                <Undo2 aria-hidden="true" />
              </ControlButton>
              <ControlButton
                onClick={store.redo}
                disabled={!canRedo}
                title={t('redo')}
                aria-label={t('redo')}
              >
                <Redo2 aria-hidden="true" />
              </ControlButton>
              <div
                role="separator"
                aria-orientation="vertical"
                className="mx-1 h-4 w-px shrink-0 self-center bg-border"
              />
              <ControlButton
                onClick={() => {
                  void commands.copy()
                }}
                disabled={selected.length === 0}
                title={t('copy')}
                aria-label={t('copy')}
              >
                <Copy aria-hidden="true" />
              </ControlButton>
              <ControlButton
                onClick={() => {
                  void commands.copy(true)
                }}
                disabled={!canCut}
                title={t('cut')}
                aria-label={t('cut')}
              >
                <Scissors aria-hidden="true" />
              </ControlButton>
              <ControlButton
                onClick={() => {
                  void commands.paste()
                }}
                disabled={!interactive}
                title={t('paste')}
                aria-label={t('paste')}
              >
                <ClipboardPaste aria-hidden="true" />
              </ControlButton>
            </Controls>
            <Controls
              position="top-right"
              orientation="horizontal"
              showZoom={false}
              showFitView={false}
              showInteractive={false}
            >
              <ControlButton
                onClick={toggleBold}
                disabled={!canEmphasize}
                title={`${t('bold')} (${emphasizeModifier === '⌘' ? '⌘B' : 'Ctrl+B'})`}
                aria-label={t('bold')}
                aria-keyshortcuts="Control+b Meta+b"
                aria-pressed={allBold}
              >
                <Bold aria-hidden="true" />
              </ControlButton>
              <ControlButton
                onClick={toggleItalic}
                disabled={!canEmphasize}
                title={`${t('italic')} (${emphasizeModifier === '⌘' ? '⌘I' : 'Ctrl+I'})`}
                aria-label={t('italic')}
                aria-keyshortcuts="Control+i Meta+i"
                aria-pressed={allItalic}
              >
                <Italic aria-hidden="true" />
              </ControlButton>
              <div
                role="separator"
                aria-orientation="vertical"
                className="mx-1 h-4 w-px shrink-0 self-center bg-border"
              />
              <ControlButton
                onClick={handleDelete}
                disabled={!canDelete}
                title={t('delete')}
                aria-label={t('delete')}
              >
                <Trash2 aria-hidden="true" />
              </ControlButton>
              <ControlButton
                onClick={handleAdd}
                disabled={!interactive}
                title={t('addConcept')}
                aria-label={t('addConcept')}
              >
                <Plus aria-hidden="true" />
              </ControlButton>
            </Controls>
          </>
        )}
      </ReactFlow>
      <GraphContextMenu
        position={contextMenu}
        label={t('contextMenu')}
        onClose={() => setContextMenu(null)}
        finalFocus={canvas}
        actions={[
          {
            label: t('copy'),
            icon: Copy,
            onClick: () => {
              void commands.copy()
            },
            disabled: selected.length === 0,
          },
          ...(!readOnly
            ? [
                {
                  label: t('cut'),
                  icon: Scissors,
                  onClick: () => {
                    void commands.copy(true)
                  },
                  disabled: !canCut,
                },
                {
                  label: t('paste'),
                  icon: ClipboardPaste,
                  onClick: () => {
                    void commands.paste(
                      undefined,
                      contextMenu?.target === 'pane'
                        ? screenToFlowPosition(contextMenu)
                        : undefined,
                    )
                  },
                  disabled: !interactive,
                },
              ]
            : []),
          ...(!readOnly && contextMenu && contextMenu.target !== 'relation'
            ? [
                {
                  label: t('addConcept'),
                  icon: Plus,
                  onClick: () => {
                    if (contextMenu.target === 'pane') addConceptAt(contextMenu)
                    else handleAdd()
                  },
                  disabled: !interactive,
                },
              ]
            : []),
          ...(!readOnly && contextMenu?.target === 'pane' && view !== null
            ? [
                {
                  label: t('addExistingConcept'),
                  icon: ListPlus,
                  onClick: commands.addExisting,
                  disabled: !interactive,
                },
              ]
            : []),
          ...(!readOnly &&
          (contextMenu?.target === 'concept' || contextMenu?.target === 'selection')
            ? [
                {
                  label: t('rearrangeSelection'),
                  icon: Network,
                  onClick: rearrange,
                  disabled: !interactive || selectedConcepts.length === 0,
                },
              ]
            : []),
          ...(!readOnly && contextMenu && contextMenu.target !== 'pane'
            ? [{ label: t('delete'), icon: Trash2, onClick: handleDelete, disabled: !canDelete }]
            : []),
          {
            label: t('selectAll'),
            icon: ListChecks,
            onClick: selectAll,
            disabled: !interactive || viewCount === 0,
          },
          {
            label: t('fitView'),
            icon: Maximize,
            onClick: () => {
              void fitView(animatedFraming)
            },
          },
        ]}
      />
    </div>
  )
}
