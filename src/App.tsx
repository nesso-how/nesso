// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/GraphCanvas'
import { TopBar } from './components/TopBar'
import {
  Sidebar,
  clampSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth,
} from './components/Sidebar'
import { BottomDock } from './components/BottomDock'
import { RelationTypesDialog } from './components/RelationTypesDialog'
import {
  Inspector,
  INSPECTOR_CANVAS_LEFT_GUTTER,
  clampInspectorPanelWidth,
  readInspectorPanelWidth,
  writeInspectorPanelWidth,
} from './components/Inspector'
import { MentorBubble } from './components/MentorBubble'
import { ReviewMode } from './components/ReviewMode'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { SearchDialog } from './components/SearchDialog'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from './store/graph'
import { useAutoSave } from './hooks/useAutoSave'
import { PALETTES } from './data/palettes'
import { findNewConceptPosition, NEW_CONCEPT_SIZE } from './data/newConceptLayout'
import { initWebLLM, localModelWeightsCached } from './llm/webllm'
import { focusFlowNodes } from './lib/focusFlowSelection'

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRelationTypes, setShowRelationTypes] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const {
    nodes,
    settings,
    addNode,
    selected,
    setSelected,
    undo,
    redo,
    copySelection,
    pasteSelection,
    deleteSelection,
    requestEditNode,
    loadGraph,
    loadGraphList,
    currentGraphId,
    viewports,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useGraphStore()

  const canUndo = useGraphStore(s => s._history.length > 0)
  const canRedo = useGraphStore(s => s._future.length > 0)

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { setViewport, setCenter, getNodes, getViewport, screenToFlowPosition } = useReactFlow()
  const [zoom, setZoom] = useState(1)

  useAutoSave()

  const [sidebarPanelWidth, setSidebarPanelWidth] = useState(readSidebarWidth)
  useEffect(() => { writeSidebarWidth(sidebarPanelWidth) }, [sidebarPanelWidth])

  const sidebarWidth = sidebarCollapsed ? 0 : sidebarPanelWidth

  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(readInspectorPanelWidth)

  useEffect(() => {
    writeInspectorPanelWidth(inspectorPanelWidth)
  }, [inspectorPanelWidth])

  // Initial load: prefer graph from URL hash
  useEffect(() => {
    let cancelled = false

    void loadGraphList().then(async list => {
      if (cancelled) return
      const hashId = location.hash.slice(1)
      const cid = useGraphStore.getState().currentGraphId
      const target = list.find(g => g.id === hashId) ? hashId : cid
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

  const fitView = useCallback((animated = true) => {
    const liveNodes = getNodes()
    if (!liveNodes.length) return

    const TOP = 52
    const BOTTOM = 80
    const RIGHT = 30
    const PADDING = 0.06

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of liveNodes) {
      const w = n.measured?.width ?? 80
      const h = n.measured?.height ?? 32
      minX = Math.min(minX, n.position.x)
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
      maxY = Math.max(maxY, n.position.y + h)
    }

    const nodeW = maxX - minX
    const nodeH = maxY - minY
    const hasInspector = selected !== null
    const leftPad = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER + (hasInspector ? inspectorPanelWidth : 0)
    const canvasW = window.innerWidth - leftPad - RIGHT
    const canvasH = window.innerHeight - TOP - BOTTOM

    const zoom = Math.max(0.15, Math.min(
      canvasW / (nodeW * (1 + 2 * PADDING)),
      canvasH / (nodeH * (1 + 2 * PADDING)),
      2.5
    ))

    const vpX = leftPad + canvasW / 2 - ((minX + maxX) / 2) * zoom
    const vpY = TOP + canvasH / 2 - ((minY + maxY) / 2) * zoom

    setViewport({ x: vpX, y: vpY, zoom }, { duration: animated ? 400 : 0 })
  }, [getNodes, setViewport, sidebarWidth, inspectorPanelWidth, selected])

  const viewportRestoredFor = useRef<string | null>(null)

  // Restore viewport when graph switches AND nodes are loaded into React Flow
  useEffect(() => {
    if (viewportRestoredFor.current === currentGraphId) return
    if (nodes.length === 0) return
    const saved = viewports[currentGraphId]
    viewportRestoredFor.current = currentGraphId
    if (saved) {
      setViewport(saved, { duration: 0 })
    } else {
      let id2 = 0
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => fitView(false))
      })
      return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2) }
    }
  }, [currentGraphId, nodes.length, fitView])

  // Local WebGPU model: if weights are already cached, load the engine without opening Settings
  useEffect(() => {
    if (settings.aiMode !== 'local') return
    let cancelled = false
    void (async () => {
      try {
        if (await localModelWeightsCached() && !cancelled) void initWebLLM()
      } catch { /* ignore cache probe failures */ }
    })()
    return () => { cancelled = true }
  }, [settings.aiMode])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
    const palette = PALETTES[settings.categoryPalette] ?? PALETTES.default
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(`--cat-${k}`, v))
    root.style.setProperty('--accent', settings.accent)
  }, [settings.dark, settings.categoryPalette, settings.accent])

  const hasSelection = !!selectedNode || !!selectedEdge

  const handleSelectNode = useCallback((node: { id: string; position: { x: number; y: number } }) => {
    setSelected({ kind: 'node', id: node.id })

    const liveNode = getNodes().find(n => n.id === node.id)
    const w = liveNode?.measured?.width ?? 160
    const h = liveNode?.measured?.height ?? 32

    const TOP = 52
    const BOTTOM = 80
    const RIGHT = 30
    const leftPad = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER + inspectorPanelWidth
    const canvasW = window.innerWidth - leftPad - RIGHT
    const canvasH = window.innerHeight - TOP - BOTTOM

    const zoom = 1.2
    setViewport(
      {
        x: leftPad + canvasW / 2 - (node.position.x + w / 2) * zoom,
        y: TOP + canvasH / 2 - (node.position.y + h / 2) * zoom,
        zoom,
      },
      { duration: 500 }
    )
  }, [setSelected, setViewport, getNodes, sidebarWidth, inspectorPanelWidth])

  const handleAddConcept = useCallback(() => {
    const topInset = 52
    const bottomInset = 80
    const leftInset = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER + (hasSelection ? inspectorPanelWidth : 0)
    const rightInset = 30
    const screenCenterX = leftInset + (window.innerWidth - leftInset - rightInset) / 2
    const screenCenterY = topInset + (window.innerHeight - topInset - bottomInset) / 2
    const { x: flowCx, y: flowCy } = screenToFlowPosition({ x: screenCenterX, y: screenCenterY })
    const { x, y } = findNewConceptPosition(nodes, flowCx, flowCy)
    const nodeCx = x + NEW_CONCEPT_SIZE.width / 2
    const nodeCy = y + NEW_CONCEPT_SIZE.height / 2
    // Prevent the viewport-restore effect from overriding our setCenter below.
    viewportRestoredFor.current = useGraphStore.getState().currentGraphId
    addNode(x, y)
    setCenter(nodeCx, nodeCy, { zoom: Math.max(getViewport().zoom, 1), duration: 300 })
  }, [addNode, setCenter, getViewport, screenToFlowPosition, sidebarWidth, hasSelection, inspectorPanelWidth, nodes])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        setShowReview(false)
        setShowShortcuts(false)
        setShowSettings(false)
        setShowRelationTypes(false)
        setShowSearch(false)
        return
      }
      if (e.key === '?') { setShowShortcuts(s => !s); return }
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowSettings(s => !s); return }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowSearch(s => !s); return }
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
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const ids = pasteSelection()
        if (ids?.length) focusFlowNodes(ids)
        return
      }
      if (
        !showReview
        && e.key === 'Enter'
        && !e.metaKey
        && !e.ctrlKey
        && !e.altKey
        && !e.shiftKey
      ) {
        const sel = useGraphStore.getState().selected
        if (sel?.kind === 'node') {
          e.preventDefault()
          requestEditNode(sel.id)
          return
        }
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { setShowReview(true); return }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !showReview) {
        handleAddConcept()
        return
      }
      if (e.key === '/') { e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, copySelection, pasteSelection, deleteSelection, requestEditNode, handleAddConcept, showReview])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <GraphCanvas
        topInset={52}
        bottomInset={80}
        leftInset={sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER + (hasSelection ? inspectorPanelWidth : 0)}
        rightInset={30}
        onViewportZoomChange={setZoom}
      />

      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onSearch={() => setShowSearch(s => !s)}
        onSettings={() => setShowSettings(s => !s)}
        onSelectConcept={handleSelectNode}
        zoom={zoom}
        width={sidebarPanelWidth}
        onWidthChange={w => setSidebarPanelWidth(clampSidebarWidth(w))}
      />

      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        onExpandSidebar={() => setSidebarCollapsed(false)}
        onReview={() => setShowReview(true)}
        onRelationTypes={() => setShowRelationTypes(s => !s)}
        onShortcuts={() => setShowShortcuts(s => !s)}
      />

      <RelationTypesDialog open={showRelationTypes} onClose={() => setShowRelationTypes(false)} />
      <Inspector
        leftOffset={sidebarWidth}
        panelWidth={inspectorPanelWidth}
        onPanelWidthChange={w => setInspectorPanelWidth(clampInspectorPanelWidth(w))}
      />
      <BottomDock
        onFit={fitView}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddConcept={handleAddConcept}
        sidebarWidth={sidebarWidth}
      />
      <MentorBubble />
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <SearchDialog open={showSearch} onClose={() => setShowSearch(false)} onSelectNode={handleSelectNode} onSelectGraph={(id) => loadGraph(id)} />
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
