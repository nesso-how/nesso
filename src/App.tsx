// SPDX-License-Identifier: MIT
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/canvas/GraphCanvas'
import { TopBar } from './components/layout/TopBar'
import {
  Sidebar,
  clampSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth,
} from './components/layout/Sidebar'
import { StatusBar, STATUS_BAR_HEIGHT_PX } from './components/layout/StatusBar'
import { RelationTypesDialog } from './components/dialogs/RelationTypesDialog'
import {
  Inspector,
  INSPECTOR_CANVAS_LEFT_GUTTER,
  INSPECTOR_RAIL_WIDTH,
  clampInspectorPanelWidth,
  readInspectorPanelWidth,
  writeInspectorPanelWidth,
} from './components/Inspector'
import { MentorBubble } from './components/mentor/MentorBubble'
import { ReviewMode } from './components/review/ReviewMode'
import { ShortcutsDialog } from './components/dialogs/ShortcutsDialog'
import { SettingsDialog } from './components/dialogs/SettingsDialog'
import { AboutDialog } from './components/dialogs/AboutDialog'
import { SearchDialog } from './components/dialogs/SearchDialog'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { ToastViewport } from './components/ui/ToastViewport'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from './store'
import { useAutoSave } from './hooks/useAutoSave'
import { useGraphFileWatch } from './hooks/useGraphFileWatch'
import { useDesktopMenu } from './hooks/useDesktopMenu'
import { GraphFileConflictBanner } from './components/banners/GraphFileConflictBanner'
import { UpdateBanner } from './components/banners/UpdateBanner'
import { PALETTES } from '@nesso-how/relation-types'
import { findNewConceptPosition, NEW_CONCEPT_SIZE } from './data/newConceptLayout'
import { initWebLLM, localModelWeightsCached } from './llm/webllm'
import { focusFlowNodes } from './lib/focusFlowSelection'
import { computeFitViewport, fitCanvasSize } from './lib/fitGraphViewport'
import { getSeedInitialFitZoom } from './data/seedGraph'

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRelationTypes, setShowRelationTypes] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const settings = useGraphStore((s) => s.settings)
  const addNode = useGraphStore((s) => s.addNode)
  const selected = useGraphStore((s) => s.selected)
  const setSelected = useGraphStore((s) => s.setSelected)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const copySelection = useGraphStore((s) => s.copySelection)
  const cutSelection = useGraphStore((s) => s.cutSelection)
  const pasteSelection = useGraphStore((s) => s.pasteSelection)
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection)
  const selectAll = useGraphStore((s) => s.selectAll)
  const deleteSelection = useGraphStore((s) => s.deleteSelection)
  const requestEditNode = useGraphStore((s) => s.requestEditNode)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const loadGraphList = useGraphStore((s) => s.loadGraphList)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const loadedToken = useGraphStore((s) => s.loadedToken)
  const viewports = useGraphStore((s) => s.viewports)
  const sidebarCollapsed = useGraphStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useGraphStore((s) => s.setSidebarCollapsed)
  const inspectorCollapsed = useGraphStore((s) => s.inspectorCollapsed)
  const confirmOpen = useGraphStore((s) => s.confirmRequest !== null)

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { setViewport, setCenter, getNodes, getViewport, screenToFlowPosition } = useReactFlow()

  useAutoSave()
  useGraphFileWatch()

  const [sidebarPanelWidth, setSidebarPanelWidth] = useState(readSidebarWidth)
  useEffect(() => {
    writeSidebarWidth(sidebarPanelWidth)
  }, [sidebarPanelWidth])

  const sidebarWidth = sidebarCollapsed ? 0 : sidebarPanelWidth

  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(readInspectorPanelWidth)

  useEffect(() => {
    writeInspectorPanelWidth(inspectorPanelWidth)
  }, [inspectorPanelWidth])

  // Initial load: prefer graph from URL hash
  useEffect(() => {
    let cancelled = false

    void loadGraphList().then(async (list) => {
      if (cancelled) return
      const hashId = location.hash.slice(1)
      const cid = useGraphStore.getState().currentGraphId
      const target = list.find((g) => g.id === hashId) ? hashId : cid
      await loadGraph(target)
    })
    return () => {
      cancelled = true
    }
  }, [loadGraphList, loadGraph])

  // Keep URL hash in sync with current graph
  useEffect(() => {
    history.replaceState({}, '', '#' + currentGraphId)
  }, [currentGraphId])

  // Browser back/forward navigation
  useEffect(() => {
    const onPop = () => {
      const hashId = location.hash.slice(1)
      if (hashId) loadGraph(hashId)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [loadGraph])

  const canvasInsets = useMemo(
    () => ({
      top: 52,
      bottom: STATUS_BAR_HEIGHT_PX,
      left: sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER,
      right:
        selected !== null ? (inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth) : 30,
    }),
    [sidebarWidth, inspectorPanelWidth, inspectorCollapsed, selected],
  )

  const fitView = useCallback(
    (animated = true) => {
      const liveNodes = getNodes()
      if (!liveNodes.length) return
      const vp = computeFitViewport(liveNodes, canvasInsets)
      setViewport(vp, { duration: animated ? 400 : 0 })
    },
    [getNodes, setViewport, canvasInsets],
  )

  useDesktopMenu({
    onSettings: () => setShowSettings(true),
    onShortcuts: () => setShowShortcuts(true),
    onAbout: () => setShowAbout(true),
    onFit: fitView,
  })

  const viewportRestoredFor = useRef<string | null>(null)
  // Set when a selection programmatically re-centers the viewport (e.g. search),
  // so the pan-on-select effect doesn't fight that animation.
  const suppressSelectPanRef = useRef(false)

  // Restore viewport before paint when graph data arrives (avoids initial flicker).
  // The computed initial fit is intentionally not persisted: only user-driven
  // viewport changes are saved (GraphCanvas `onMoveEnd`, autosave).
  useLayoutEffect(() => {
    if (viewportRestoredFor.current === currentGraphId) return
    if (loadedToken === 0) return
    const saved = viewports[currentGraphId]

    const restore = () => {
      const vp =
        saved ??
        computeFitViewport(
          useGraphStore.getState().nodes,
          canvasInsets,
          getSeedInitialFitZoom(currentGraphId) ?? 1,
        )
      viewportRestoredFor.current = currentGraphId
      setViewport(vp, { duration: 0 })
    }

    if (!saved) {
      // Embedded WebViews can report a 0×0 window before first layout; a fit
      // computed there collapses to minimum zoom. Wait for a usable size.
      const { width, height } = fitCanvasSize(canvasInsets)
      if (width <= 0 || height <= 0) {
        const onResize = () => {
          const size = fitCanvasSize(canvasInsets)
          if (size.width <= 0 || size.height <= 0) return
          window.removeEventListener('resize', onResize)
          restore()
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }
    }
    restore()
  }, [currentGraphId, loadedToken, viewports, canvasInsets, setViewport])

  // Local WebGPU model: if weights are already cached, load the engine without opening Settings
  useEffect(() => {
    if (settings.aiMode !== 'local') return
    let cancelled = false
    void (async () => {
      try {
        if ((await localModelWeightsCached()) && !cancelled) void initWebLLM()
      } catch {
        /* ignore cache probe failures */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settings.aiMode])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
    const palette = PALETTES[settings.categoryPalette] ?? PALETTES.default
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(`--cat-${k}`, v))
    root.style.setProperty('--accent', settings.dark ? '#c47a82' : '#6e2730')
  }, [settings.dark, settings.categoryPalette])

  const hasSelection = !!selectedNode || !!selectedEdge

  const handleSelectNode = useCallback(
    (node: { id: string; position: { x: number; y: number } }) => {
      suppressSelectPanRef.current = true
      setSelected({ kind: 'node', id: node.id })

      const liveNode = getNodes().find((n) => n.id === node.id)
      const w = liveNode?.measured?.width ?? 160
      const h = liveNode?.measured?.height ?? 32

      const TOP = 52
      const BOTTOM = STATUS_BAR_HEIGHT_PX
      const RIGHT = inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth
      const leftPad = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER
      const canvasW = window.innerWidth - leftPad - RIGHT
      const canvasH = window.innerHeight - TOP - BOTTOM

      const zoom = 1.2
      setViewport(
        {
          x: leftPad + canvasW / 2 - (node.position.x + w / 2) * zoom,
          y: TOP + canvasH / 2 - (node.position.y + h / 2) * zoom,
          zoom,
        },
        { duration: 500 },
      )
    },
    [setSelected, setViewport, getNodes, sidebarWidth, inspectorPanelWidth, inspectorCollapsed],
  )

  const handleAddConcept = useCallback(() => {
    const topInset = 52
    const bottomInset = STATUS_BAR_HEIGHT_PX
    const leftInset = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER
    const rightInset = hasSelection
      ? inspectorCollapsed
        ? INSPECTOR_RAIL_WIDTH
        : inspectorPanelWidth
      : 30
    const screenCenterX = leftInset + (window.innerWidth - leftInset - rightInset) / 2
    const screenCenterY = topInset + (window.innerHeight - topInset - bottomInset) / 2
    const { x: flowCx, y: flowCy } = screenToFlowPosition({ x: screenCenterX, y: screenCenterY })
    const { x, y } = findNewConceptPosition(useGraphStore.getState().nodes, flowCx, flowCy)
    const nodeCx = x + NEW_CONCEPT_SIZE.width / 2
    const nodeCy = y + NEW_CONCEPT_SIZE.height / 2
    // Prevent the viewport-restore effect from overriding our setCenter below.
    viewportRestoredFor.current = useGraphStore.getState().currentGraphId
    addNode(x, y)
    setCenter(nodeCx, nodeCy, { zoom: Math.max(getViewport().zoom, 1), duration: 300 })
  }, [
    addNode,
    setCenter,
    getViewport,
    screenToFlowPosition,
    sidebarWidth,
    hasSelection,
    inspectorPanelWidth,
    inspectorCollapsed,
  ])

  // Pan-on-select: nudge the viewport so the selected node/edge stays clear of the
  // right-docked inspector (and other chrome). Only fires when the element falls
  // outside the comfortable visible area; never fights manual panning.
  useEffect(() => {
    if (!selected) return
    if (suppressSelectPanRef.current) {
      suppressSelectPanRef.current = false
      return
    }
    const liveNodes = getNodes()
    let wx: number
    let wy: number
    if (selected.kind === 'node') {
      const n = liveNodes.find((nd) => nd.id === selected.id)
      if (!n) return
      wx = n.position.x + (n.measured?.width ?? 160) / 2
      wy = n.position.y + (n.measured?.height ?? 32) / 2
    } else {
      const e = useGraphStore.getState().edges.find((ed) => ed.id === selected.id)
      if (!e) return
      const s = liveNodes.find((nd) => nd.id === e.source)
      const tg = liveNodes.find((nd) => nd.id === e.target)
      if (!s || !tg) return
      wx =
        (s.position.x +
          (s.measured?.width ?? 160) / 2 +
          tg.position.x +
          (tg.measured?.width ?? 160) / 2) /
        2
      wy =
        (s.position.y +
          (s.measured?.height ?? 32) / 2 +
          tg.position.y +
          (tg.measured?.height ?? 32) / 2) /
        2
    }
    const v = getViewport()
    const sx = wx * v.zoom + v.x
    const sy = wy * v.zoom + v.y
    const M = 56
    const rightInset = inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth
    const left = sidebarWidth + M
    const right = window.innerWidth - rightInset - M
    const top = 52 + M
    const bottom = window.innerHeight - STATUS_BAR_HEIGHT_PX - M
    let dx = 0
    let dy = 0
    if (right > left) {
      if (sx < left) dx = left - sx
      else if (sx > right) dx = right - sx
    }
    if (bottom > top) {
      if (sy < top) dy = top - sy
      else if (sy > bottom) dy = bottom - sy
    }
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
    setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom }, { duration: 300 })
  }, [
    selected,
    getNodes,
    getViewport,
    setViewport,
    sidebarWidth,
    inspectorPanelWidth,
    inspectorCollapsed,
  ])

  // Keyboard shortcuts
  const anyModalOpen =
    showReview ||
    showShortcuts ||
    showSettings ||
    showRelationTypes ||
    showSearch ||
    showAbout ||
    confirmOpen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        setShowReview(false)
        setShowShortcuts(false)
        setShowSettings(false)
        setShowRelationTypes(false)
        setShowSearch(false)
        setShowAbout(false)
        return
      }
      if (e.key === '?') {
        setShowShortcuts((s) => !s)
        return
      }
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowSettings((s) => !s)
        return
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowSearch((s) => !s)
        return
      }
      // Everything below edits or navigates the canvas — never while a modal
      // is open (e.g. Backspace during a review must not delete the selection).
      if (anyModalOpen) return
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelection()
        return
      }
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        copySelection()
        return
      }
      if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        cutSelection()
        return
      }
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const ids = pasteSelection()
        if (ids?.length) focusFlowNodes(ids)
        return
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const ids = duplicateSelection()
        if (ids?.length) focusFlowNodes(ids)
        return
      }
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        selectAll()
        return
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const sel = useGraphStore.getState().selected
        if (sel?.kind === 'node') {
          e.preventDefault()
          requestEditNode(sel.id)
          return
        }
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        setShowReview(true)
        return
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        handleAddConcept()
        return
      }
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        fitView()
        return
      }
      if (e.key === '/') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteSelection,
    duplicateSelection,
    selectAll,
    deleteSelection,
    requestEditNode,
    handleAddConcept,
    fitView,
    anyModalOpen,
  ])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <GraphCanvas
        topInset={52}
        bottomInset={STATUS_BAR_HEIGHT_PX}
        leftInset={sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER}
        rightInset={
          hasSelection ? (inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth) : 30
        }
        onFit={fitView}
      />

      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onSearch={() => setShowSearch((s) => !s)}
        onSettings={() => setShowSettings((s) => !s)}
        width={sidebarPanelWidth}
        onWidthChange={(w) => setSidebarPanelWidth(clampSidebarWidth(w))}
      />

      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        onExpandSidebar={() => setSidebarCollapsed(false)}
        onReview={() => setShowReview(true)}
        onRelationTypes={() => setShowRelationTypes((s) => !s)}
        onShortcuts={() => setShowShortcuts((s) => !s)}
        onAbout={() => setShowAbout(true)}
      />

      <RelationTypesDialog open={showRelationTypes} onClose={() => setShowRelationTypes(false)} />
      <Inspector
        panelWidth={inspectorPanelWidth}
        onPanelWidthChange={(w) => setInspectorPanelWidth(clampInspectorPanelWidth(w))}
      />
      <StatusBar sidebarWidth={sidebarWidth} onFit={fitView} />
      <MentorBubble
        leftInset={sidebarWidth}
        rightInset={
          hasSelection ? (inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth) : 0
        }
      />
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectNode={handleSelectNode}
        onSelectGraph={(id) => loadGraph(id)}
      />
      <div
        style={{
          position: 'fixed',
          top: 60,
          right: 16,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <GraphFileConflictBanner />
        <UpdateBanner />
        <ToastViewport />
      </div>
      <ConfirmDialog />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
