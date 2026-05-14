// SPDX-License-Identifier: MIT
import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/GraphCanvas'
import { TopBar } from './components/TopBar'
import { Sidebar, SIDEBAR_WIDTH } from './components/Sidebar'
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
    deleteNode,
    deleteEdge,
    undo,
    redo,
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

  const sidebarWidth = sidebarCollapsed ? 0 : SIDEBAR_WIDTH

  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(readInspectorPanelWidth)

  useEffect(() => {
    writeInspectorPanelWidth(inspectorPanelWidth)
  }, [inspectorPanelWidth])

  // Initial load: prefer graph from URL hash
  useEffect(() => {
    loadGraphList().then(list => {
      const hashId = location.hash.slice(1)
      const target = list.find(g => g.id === hashId) ? hashId : currentGraphId
      loadGraph(target)
    })
  }, [])

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

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
    const palette = PALETTES[settings.categoryPalette] ?? PALETTES.default
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(`--cat-${k}`, v))
    root.style.setProperty('--accent', settings.accent)
  }, [settings.dark, settings.categoryPalette, settings.accent])

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
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { setShowReview(true) }
      if (e.key === '/') { e.preventDefault() }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        if (selected.kind === 'node') deleteNode(selected.id)
        else deleteEdge(selected.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, deleteNode, deleteEdge, undo, redo])

  const hasSelection = !!selectedNode || !!selectedEdge

  const handleSelectNode = useCallback((node: { id: string; position: { x: number; y: number } }) => {
    setSelected({ kind: 'node', id: node.id })
    setCenter(node.position.x + 100, node.position.y + 30, { zoom: 1.2, duration: 500 })
  }, [setSelected, setCenter])

  const handleAddConcept = useCallback(() => {
    const topInset = 52
    const bottomInset = 80
    const leftInset = sidebarWidth + INSPECTOR_CANVAS_LEFT_GUTTER + (hasSelection ? inspectorPanelWidth : 0)
    const rightInset = 30
    const screenCenterX = leftInset + (window.innerWidth - leftInset - rightInset) / 2
    const screenCenterY = topInset + (window.innerHeight - topInset - bottomInset) / 2
    const { x: fx, y: fy } = screenToFlowPosition({ x: screenCenterX, y: screenCenterY })
    // Prevent the viewport-restore effect from overriding our setCenter below.
    viewportRestoredFor.current = useGraphStore.getState().currentGraphId
    addNode(fx, fy)
    setCenter(fx, fy, { zoom: Math.max(getViewport().zoom, 1), duration: 300 })
  }, [addNode, setCenter, getViewport, screenToFlowPosition, sidebarWidth, hasSelection, inspectorPanelWidth])

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
