// SPDX-License-Identifier: AGPL-3.0
import { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/GraphCanvas'
import { TopBar } from './components/TopBar'
import { BottomDock } from './components/BottomDock'
import { RelationTypesDialog } from './components/RelationTypesDialog'
import { Inspector } from './components/Inspector'
import { MentorBubble } from './components/MentorBubble'
import { Onboarding } from './components/Onboarding'
import { ReviewMode } from './components/ReviewMode'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from './store/graph'
import { useAutoSave } from './hooks/useAutoSave'
import { PALETTES } from './data/palettes'

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRelationTypes, setShowRelationTypes] = useState(false)

  const {
    settings,
    addNode,
    selected,
    deleteNode,
    deleteEdge,
    tutorialDone,
    completeTutorial,
    loadGraph,
    loadGraphList,
    currentGraphId,
    viewports,
  } = useGraphStore()

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow()
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
      if (e.key === 'Escape') {
        completeTutorial()
        setShowReview(false)
        setShowShortcuts(false)
        setShowSettings(false)
        setShowRelationTypes(false)
        return
      }
      if (e.key === '?') { setShowShortcuts(s => !s); return }
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowSettings(s => !s); return }
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
  }, [selected, deleteNode, deleteEdge, completeTutorial])

  const handleAddConcept = useCallback(() => {
    addNode(-200 + (Math.random() - 0.5) * 120, 280 + (Math.random() - 0.5) * 60)
  }, [addNode])

  const handleFit = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 })
  }, [fitView])

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 })
  }, [zoomIn])

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 })
  }, [zoomOut])

  const hasSelection = !!selectedNode || !!selectedEdge

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <GraphCanvas
        topInset={80}
        bottomInset={80}
        leftInset={hasSelection ? 326 : 30}
        rightInset={30}
        onViewportZoomChange={setZoom}
      />

      <TopBar
        onReview={() => setShowReview(true)}
        onShortcuts={() => setShowShortcuts(s => !s)}
        onSettings={() => setShowSettings(s => !s)}
        onRelationTypes={() => setShowRelationTypes(s => !s)}
      />
      <RelationTypesDialog open={showRelationTypes} onClose={() => setShowRelationTypes(false)} />
      <Inspector />
      <BottomDock
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
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
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
