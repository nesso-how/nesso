import { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/GraphCanvas'
import { TopBar } from './components/TopBar'
import { BottomDock } from './components/BottomDock'
import { EdgeLegend } from './components/EdgeLegend'
import { Inspector } from './components/Inspector'
import { MentorBubble } from './components/MentorBubble'
import { Onboarding } from './components/Onboarding'
import { ReviewMode } from './components/ReviewMode'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from './store/graph'
import { useAutoSave } from './hooks/useAutoSave'
import { PALETTES } from './data/palettes'

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const {
    settings,
    addNode,
    selected,
    deleteNode,
    deleteEdge,
    tutorialDone,
    completeTutorial,
    relationTypesPanelOpen,
    setRelationTypesPanelOpen,
    toggleRelationTypesPanel,
    loadGraph,
    loadGraphList,
    currentGraphId,
    viewports,
  } = useGraphStore()

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { zoomIn, zoomOut, fitView, setViewport, getZoom } = useReactFlow()
  const [zoom, setZoom] = useState(1)

  useAutoSave()

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

  // Restore saved viewport instantly on graph switch (no animation)
  useEffect(() => {
    const saved = viewports[currentGraphId]
    if (saved) {
      setViewport(saved, { duration: 0 })
    } else {
      fitView({ padding: 0.15, duration: 0 })
    }
  }, [currentGraphId])

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
      if (e.key === 'Escape') { completeTutorial(); setShowReview(false); setShowShortcuts(false); return }
      if (e.key === '?') { setShowShortcuts(s => !s); return }
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowReview(true) }
      if (e.key === '/') { e.preventDefault() }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        if (selected.kind === 'node') deleteNode(selected.id)
        else deleteEdge(selected.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, deleteNode, deleteEdge, completeTutorial])

  const handleAddConcept = useCallback(() => {
    addNode(-200 + (Math.random() - 0.5) * 120, 280 + (Math.random() - 0.5) * 60)
  }, [addNode])

  const handleFit = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 })
  }, [fitView])

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 })
    setTimeout(() => setZoom(getZoom()), 220)
  }, [zoomIn, getZoom])

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 })
    setTimeout(() => setZoom(getZoom()), 220)
  }, [zoomOut, getZoom])

  const hasSelection = !!selectedNode || !!selectedEdge

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <GraphCanvas
        topInset={80}
        bottomInset={80}
        leftInset={relationTypesPanelOpen ? 320 : 30}
        rightInset={hasSelection ? 326 : 30}
      />

      <TopBar onReview={() => setShowReview(true)} onShortcuts={() => setShowShortcuts(s => !s)} />
      <EdgeLegend open={relationTypesPanelOpen} onClose={() => setRelationTypesPanelOpen(false)} />
      <Inspector />
      <BottomDock
        legendOpen={relationTypesPanelOpen}
        onToggleLegend={toggleRelationTypesPanel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        zoom={zoom}
        onAddConcept={handleAddConcept}
      />
      <MentorBubble />
      <Onboarding open={!tutorialDone} onClose={completeTutorial} />
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
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
