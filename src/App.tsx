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
import { MentorPanel } from './components/mentor/MentorPanel'
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
import { TelemetryConsentBanner } from './components/banners/TelemetryConsentBanner'
import { WelcomeDialog } from './components/onboarding/WelcomeDialog'
import { CoachmarkOverlay } from './components/onboarding/CoachmarkOverlay'
import { ONBOARDING_STEPS } from './components/onboarding/onboardingSteps'
import { PALETTES } from '@nesso-how/vocab-learning'
import { findNewConceptPosition, NEW_CONCEPT_SIZE } from './data/newConceptLayout'
import { focusFlowNodes } from './lib/focusFlowSelection'
import { resolveShortcut } from './lib/shortcuts'
import { computeSelectionPan } from './lib/selectionPan'
import { computeFitViewport, fitCanvasSize } from './lib/fitGraphViewport'
import { getSeedInitialFitZoom, getSeedsForLanguage } from './data/seedGraph'
import { APP_VERSION } from './data/appInfo'
import { isDesktop } from './lib/isDesktop'
import { initTelemetry, shutdownTelemetry, track } from './telemetry'

type OnboardingPhase = 'idle' | 'welcome' | 'tour' | 'consent'

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRelationTypes, setShowRelationTypes] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>('idle')
  const [tourStep, setTourStep] = useState(0)
  const [reviewOpenedDuringTour, setReviewOpenedDuringTour] = useState(false)

  const settings = useGraphStore((s) => s.settings)
  const telemetry = settings.telemetry
  const telemetryPromptShown = settings.telemetryPromptShown
  const setSetting = useGraphStore((s) => s.setSetting)
  const setOnboardingStep = useGraphStore((s) => s.setOnboardingStep)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)
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
  const importGraph = useGraphStore((s) => s.importGraph)
  const deleteGraph = useGraphStore((s) => s.deleteGraph)
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

  useEffect(() => {
    if (telemetry) void initTelemetry(true)
    else void shutdownTelemetry()
  }, [telemetry])

  const appStartedRef = useRef(false)
  useEffect(() => {
    if (appStartedRef.current) return
    appStartedRef.current = true
    track({
      name: 'app_started',
      props: {
        version: APP_VERSION,
        platform: isDesktop() ? 'desktop' : 'web',
        language: useGraphStore.getState().settings.language,
      },
    })
  }, [])

  const openReview = useCallback(() => {
    track({ name: 'review_session_started' })
    if (onboardingPhase === 'tour' && tourStep === 5) {
      setReviewOpenedDuringTour(true)
    }
    setShowReview(true)
  }, [onboardingPhase, tourStep])

  const finishOnboarding = useCallback(() => {
    setOnboardingStep(null)
    setSetting('onboardingCompleted', true)
    setOnboardingPhase('idle')
  }, [setOnboardingStep, setSetting])

  // Replace the empty "Tutorial" graph as the active map with a fresh seed demo
  // so the user lands on something explorable once onboarding ends.
  const openSeedMap = useCallback(async () => {
    const seed = getSeedsForLanguage(useGraphStore.getState().settings.language)[0]
    if (!seed) return
    await importGraph(seed.name, seed.nodes, seed.edges, seed.display)
  }, [importGraph])

  const goToConsentOrFinish = useCallback(
    async (skipped = false) => {
      setOnboardingStep(null)
      // Only on first completion — replaying the tour from About must not spawn
      // duplicate seed maps (onboardingCompleted is already true by then).
      if (!useGraphStore.getState().settings.onboardingCompleted) {
        await openSeedMap()
        if (skipped) {
          const tutorial = useGraphStore.getState().graphList.find((g) => g.name === 'Tutorial')
          if (tutorial) await deleteGraph(tutorial.id)
        }
      }
      if (telemetryPromptShown) {
        finishOnboarding()
      } else {
        setOnboardingPhase('consent')
      }
    },
    [telemetryPromptShown, finishOnboarding, setOnboardingStep, openSeedMap, deleteGraph],
  )

  const startTour = useCallback(() => {
    setTourStep(0)
    setReviewOpenedDuringTour(false)
    setOnboardingPhase('tour')
  }, [])

  const skipWelcome = useCallback(() => {
    void goToConsentOrFinish(true)
  }, [goToConsentOrFinish])

  const skipTour = useCallback(() => {
    void goToConsentOrFinish(true)
  }, [goToConsentOrFinish])

  const advanceTour = useCallback(() => {
    if (tourStep >= ONBOARDING_STEPS.length - 1) {
      void goToConsentOrFinish(false)
      return
    }
    setTourStep((s) => s + 1)
  }, [tourStep, goToConsentOrFinish])

  const relaunchTour = useCallback(() => {
    setShowAbout(false)
    setTourStep(0)
    setReviewOpenedDuringTour(false)
    setOnboardingPhase('tour')
  }, [])

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
      if (cancelled) return
      if (!useGraphStore.getState().settings.onboardingCompleted) {
        setOnboardingPhase('welcome')
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadGraphList, loadGraph])

  useEffect(() => {
    if (onboardingPhase === 'tour') setOnboardingStep(tourStep)
    else setOnboardingStep(null)
  }, [onboardingPhase, tourStep, setOnboardingStep])

  // Definition step: make sure the inspector is open and pointed at the first
  // concept so its definition field (the spotlight anchor) is on screen.
  useEffect(() => {
    if (onboardingPhase === 'tour' && tourStep === 2) {
      setInspectorCollapsed(false)
      const firstId = useGraphStore.getState().nodes[0]?.id
      if (firstId) setSelected({ kind: 'node', id: firstId })
    }
  }, [onboardingPhase, tourStep, setInspectorCollapsed, setSelected])

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
  // Holds the id whose selection programmatically re-centers the viewport (e.g.
  // search), so the pan-on-select effect skips that one animation. Keyed by id
  // (not a bare flag) so a no-op re-selection of the current node can't leak the
  // suppression onto a later, unrelated selection.
  const suppressSelectPanRef = useRef<string | null>(null)

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

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
    const palette = PALETTES[settings.categoryPalette] ?? PALETTES.default
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(`--cat-${k}`, v))
  }, [settings.dark, settings.categoryPalette])

  const hasSelection = !!selectedNode || !!selectedEdge

  const handleSelectNode = useCallback(
    (node: { id: string; position: { x: number; y: number } }) => {
      suppressSelectPanRef.current = node.id
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
    track({ name: 'node_created' })
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
    // Always consume the suppression token; only skip when it matches the
    // element being selected now (so a stale token can't suppress a later pan).
    const suppressId = suppressSelectPanRef.current
    suppressSelectPanRef.current = null
    if (suppressId === selected.id) return
    const liveNodes = getNodes()
    const NODE_W = 160
    const NODE_H = 32
    // World-space bounding box of the selection (the node, or both edge endpoints).
    let wLeft: number
    let wTop: number
    let wRight: number
    let wBottom: number
    if (selected.kind === 'node') {
      const n = liveNodes.find((nd) => nd.id === selected.id)
      if (!n) return
      wLeft = n.position.x
      wTop = n.position.y
      wRight = n.position.x + (n.measured?.width ?? NODE_W)
      wBottom = n.position.y + (n.measured?.height ?? NODE_H)
    } else {
      const e = useGraphStore.getState().edges.find((ed) => ed.id === selected.id)
      if (!e) return
      const s = liveNodes.find((nd) => nd.id === e.source)
      const tg = liveNodes.find((nd) => nd.id === e.target)
      if (!s || !tg) return
      wLeft = Math.min(s.position.x, tg.position.x)
      wTop = Math.min(s.position.y, tg.position.y)
      wRight = Math.max(
        s.position.x + (s.measured?.width ?? NODE_W),
        tg.position.x + (tg.measured?.width ?? NODE_W),
      )
      wBottom = Math.max(
        s.position.y + (s.measured?.height ?? NODE_H),
        tg.position.y + (tg.measured?.height ?? NODE_H),
      )
    }
    const v = getViewport()
    const M = 56
    const rightInset = inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth
    const pan = computeSelectionPan({ left: wLeft, top: wTop, right: wRight, bottom: wBottom }, v, {
      left: sidebarWidth + M,
      right: window.innerWidth - rightInset - M,
      top: 52 + M,
      bottom: window.innerHeight - STATUS_BAR_HEIGHT_PX - M,
    })
    if (!pan) return
    setViewport({ x: v.x + pan.dx, y: v.y + pan.dy, zoom: v.zoom }, { duration: 300 })
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
    onboardingPhase === 'welcome' ||
    onboardingPhase === 'tour' ||
    confirmOpen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const resolved = resolveShortcut(e, {
        anyModalOpen,
        hasSelectedNode: useGraphStore.getState().selected?.kind === 'node',
      })
      if (!resolved) return
      if (resolved.preventDefault) e.preventDefault()
      switch (resolved.action) {
        case 'close-modals':
          setShowReview(false)
          setShowShortcuts(false)
          setShowSettings(false)
          setShowRelationTypes(false)
          setShowSearch(false)
          setShowAbout(false)
          break
        case 'toggle-shortcuts':
          setShowShortcuts((s) => !s)
          break
        case 'toggle-settings':
          setShowSettings((s) => !s)
          break
        case 'toggle-search':
          setShowSearch((s) => !s)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
        case 'delete-selection':
          deleteSelection()
          break
        case 'copy':
          copySelection()
          break
        case 'cut':
          cutSelection()
          break
        case 'paste': {
          const ids = pasteSelection()
          if (ids?.length) focusFlowNodes(ids)
          break
        }
        case 'duplicate': {
          const ids = duplicateSelection()
          if (ids?.length) focusFlowNodes(ids)
          break
        }
        case 'select-all':
          selectAll()
          break
        case 'edit-selected-node': {
          const sel = useGraphStore.getState().selected
          if (sel?.kind === 'node') requestEditNode(sel.id)
          break
        }
        case 'open-review':
          if (useGraphStore.getState().settings.reviewEnabled) openReview()
          break
        case 'add-concept':
          handleAddConcept()
          break
        case 'fit-view':
          fitView()
          break
        case 'block':
          break
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
    openReview,
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
        onReview={openReview}
        onRelationTypes={() => setShowRelationTypes((s) => !s)}
        onShortcuts={() => setShowShortcuts((s) => !s)}
        onAbout={() => setShowAbout(true)}
        onboardingStep={onboardingPhase === 'tour' ? tourStep : null}
      />

      <RelationTypesDialog open={showRelationTypes} onClose={() => setShowRelationTypes(false)} />
      <Inspector
        panelWidth={inspectorPanelWidth}
        onPanelWidthChange={(w) => setInspectorPanelWidth(clampInspectorPanelWidth(w))}
      />
      <StatusBar sidebarWidth={sidebarWidth} onFit={fitView} />
      <MentorPanel
        leftInset={sidebarWidth}
        rightInset={
          hasSelection ? (inspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorPanelWidth) : 0
        }
      />
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AboutDialog
        open={showAbout}
        onClose={() => setShowAbout(false)}
        onShowIntroAgain={relaunchTour}
      />
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectNode={handleSelectNode}
        onSelectGraph={(id) => loadGraph(id)}
      />
      <WelcomeDialog
        open={onboardingPhase === 'welcome'}
        onShowMeHow={startTour}
        onSkipIntro={skipWelcome}
      />
      {onboardingPhase === 'tour' && !showReview && (
        <CoachmarkOverlay
          stepIndex={tourStep}
          reviewOpened={reviewOpenedDuringTour}
          onSkip={skipTour}
          onNext={advanceTour}
        />
      )}
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
        <TelemetryConsentBanner open={onboardingPhase === 'consent'} onDismiss={finishOnboarding} />
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
