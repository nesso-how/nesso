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
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from './store/graph'
import { PALETTES } from './data/palettes'

function AppInner() {
  const [legendOpen, setLegendOpen] = useState(true)
  const [showReview, setShowReview] = useState(false)

  const { settings, setSetting, addNode, selected, deleteNode, deleteEdge, tutorialDone, completeTutorial } = useGraphStore()
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const [zoom, setZoom] = useState(1)

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
      if (e.key === 'Escape') { completeTutorial(); setShowReview(false); return }
      if (e.key === '?') setLegendOpen(l => !l)
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
  }, [selected, deleteNode, deleteEdge])

  const handleAddConcept = useCallback(() => {
    // Place new concept near center of view
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
        leftInset={legendOpen ? 320 : 30}
        rightInset={hasSelection ? 326 : 30}
      />

      <TopBar graphTitle="Programming concepts" onReview={() => setShowReview(true)} />
      <EdgeLegend open={legendOpen} onClose={() => setLegendOpen(false)} />
      <Inspector />
      <BottomDock
        legendOpen={legendOpen}
        onToggleLegend={() => setLegendOpen(o => !o)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        zoom={zoom}
        onAddConcept={handleAddConcept}
      />
      <MentorBubble />
      <Onboarding open={!tutorialDone} onClose={completeTutorial} />
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
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
