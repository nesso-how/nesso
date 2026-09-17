// SPDX-License-Identifier: MIT
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { GraphCanvas } from './components/canvas/GraphCanvas'
import { TopBar, TOPBAR_HEIGHT_PX } from './components/layout/TopBar'
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
import { WritingMode } from './components/writing/WritingMode'
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
import { useOnboardingFlow } from './hooks/useOnboardingFlow'
import { GraphFileConflictBanner } from './components/banners/GraphFileConflictBanner'
import { UpdateBanner } from './components/banners/UpdateBanner'
import { ReviewReminderBanner } from './components/banners/ReviewReminderBanner'
import { TelemetryConsentBanner } from './components/banners/TelemetryConsentBanner'
import { WelcomeDialog } from './components/onboarding/WelcomeDialog'
import { CoachmarkOverlay } from './components/onboarding/CoachmarkOverlay'
import { PALETTES } from '@nesso-how/vocab-learning'
import { findNewConceptPosition, NEW_CONCEPT_SIZE } from './data/newConceptLayout'
import { focusFlowNodes } from './lib/focusFlowSelection'
import { resolveShortcut, isTextControlFocused } from './lib/shortcuts'
import { computeSelectionPan } from './lib/selectionPan'
import { computeFitViewport, fitCanvasSize } from './lib/fitGraphViewport'
import { getSeedInitialFitZoom } from './data/seedGraph'
import { APP_VERSION } from './data/appInfo'
import { isDesktop } from './lib/isDesktop'
import { initTelemetry, shutdownTelemetry, track } from './telemetry'

interface CanvasInsets {
  top: number
  bottom: number
  left: number
  right: number
}

interface ResolveCanvasInsetsArgs {
  sidebarWidth: number
  inspectorPanelWidth: number
  inspectorCollapsed: boolean
  /** Whether the inspector currently occupies canvas space; differs per consumer. */
  inspectorVisible: boolean
  /** Right inset when the inspector is hidden; differs per overlay. */
  emptyRightInset?: number
  /** Gutter added to the sidebar width; MentorPanel docks without it. */
  leftGutter?: number
}

/**
 * Single derivation for canvas insets. Every inset consumer in this file routes
 * through here; per-overlay differences (inspector visibility condition, hidden
 * right fallback, left gutter) are explicit inputs so each call site keeps its
 * previous output byte-for-byte.
 */
function resolveCanvasInsets({
  sidebarWidth,
  inspectorPanelWidth,
  inspectorCollapsed,
  inspectorVisible,
  emptyRightInset = 30,
  leftGutter = INSPECTOR_CANVAS_LEFT_GUTTER,
}: ResolveCanvasInsetsArgs): CanvasInsets {
  return {
    top: TOPBAR_HEIGHT_PX,
    bottom: STATUS_BAR_HEIGHT_PX,
    left: sidebarWidth + leftGutter,
    right: inspectorVisible
      ? inspectorCollapsed
        ? INSPECTOR_RAIL_WIDTH
        : inspectorPanelWidth
      : emptyRightInset,
  }
}

function AppInner() {
  const [showReview, setShowReview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRelationTypes, setShowRelationTypes] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const onboarding = useOnboardingFlow()

  const settings = useGraphStore((s) => s.settings)
  const mentorEnabled = settings.mentorEnabled
  const setMentorPanelExpanded = useGraphStore((s) => s.setMentorPanelExpanded)
  const telemetry = settings.telemetry
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
  const writingModeNodeId = useGraphStore((s) => s.writingModeNodeId)
  const closeWritingMode = useGraphStore((s) => s.closeWritingMode)

  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const { setViewport, setCenter, getNodes, getViewport, screenToFlowPosition } = useReactFlow()

  useAutoSave()
  useGraphFileWatch()

  useEffect(() => {
    if (telemetry) void initTelemetry(true)
    else void shutdownTelemetry()
  }, [telemetry])

  useEffect(() => {
    if (!mentorEnabled) setMentorPanelExpanded(false)
  }, [mentorEnabled, setMentorPanelExpanded])

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
    onboarding.noteReviewOpenedDuringTour()
    setShowReview(true)
  }, [onboarding.noteReviewOpenedDuringTour])

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

    void loadGraphList()
      .then(async (list) => {
        if (cancelled) return
        const hashId = location.hash.slice(1)
        const cid = useGraphStore.getState().currentGraphId
        const target = list.find((g) => g.id === hashId) ? hashId : cid
        await loadGraph(target)
        if (cancelled) return
        onboarding.onGraphListLoaded()
      })
      .catch((err) => {
        console.error('[nesso] startup graph list load failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [loadGraphList, loadGraph, onboarding.onGraphListLoaded])

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
    () =>
      resolveCanvasInsets({
        sidebarWidth,
        inspectorPanelWidth,
        inspectorCollapsed,
        inspectorVisible: selected !== null,
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

  const anyModalOpen =
    showReview ||
    showShortcuts ||
    showSettings ||
    showRelationTypes ||
    showSearch ||
    showAbout ||
    writingModeNodeId !== null ||
    onboarding.anyModalOpen ||
    confirmOpen

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

  // Overlay insets share the canvas derivation but key inspector visibility on
  // the resolved selection (the Inspector renders only when a node/edge
  // resolves). MentorPanel docks flush to the sidebar and collapses to 0.
  const overlayInsets = useMemo(
    () =>
      resolveCanvasInsets({
        sidebarWidth,
        inspectorPanelWidth,
        inspectorCollapsed,
        inspectorVisible: hasSelection,
      }),
    [sidebarWidth, inspectorPanelWidth, inspectorCollapsed, hasSelection],
  )
  const mentorInsets = useMemo(
    () =>
      resolveCanvasInsets({
        sidebarWidth,
        inspectorPanelWidth,
        inspectorCollapsed,
        inspectorVisible: hasSelection,
        emptyRightInset: 0,
        leftGutter: 0,
      }),
    [sidebarWidth, inspectorPanelWidth, inspectorCollapsed, hasSelection],
  )

  const handleSelectNode = useCallback(
    (node: { id: string; position: { x: number; y: number } }) => {
      suppressSelectPanRef.current = node.id
      setSelected({ kind: 'node', id: node.id })

      const liveNode = getNodes().find((n) => n.id === node.id)
      const w = liveNode?.measured?.width ?? 160
      const h = liveNode?.measured?.height ?? 32

      // A selection is being established, so the inspector will occupy space.
      const selectInsets = resolveCanvasInsets({
        sidebarWidth,
        inspectorPanelWidth,
        inspectorCollapsed,
        inspectorVisible: true,
      })
      const canvasW = window.innerWidth - selectInsets.left - selectInsets.right
      const canvasH = window.innerHeight - selectInsets.top - selectInsets.bottom

      const zoom = 1.2
      setViewport(
        {
          x: selectInsets.left + canvasW / 2 - (node.position.x + w / 2) * zoom,
          y: selectInsets.top + canvasH / 2 - (node.position.y + h / 2) * zoom,
          zoom,
        },
        { duration: 500 },
      )
    },
    [setSelected, setViewport, getNodes, sidebarWidth, inspectorPanelWidth, inspectorCollapsed],
  )

  const handleAddConcept = useCallback(() => {
    const screenCenterX =
      overlayInsets.left + (window.innerWidth - overlayInsets.left - overlayInsets.right) / 2
    const screenCenterY =
      overlayInsets.top + (window.innerHeight - overlayInsets.top - overlayInsets.bottom) / 2
    const { x: flowCx, y: flowCy } = screenToFlowPosition({ x: screenCenterX, y: screenCenterY })
    const { x, y } = findNewConceptPosition(useGraphStore.getState().nodes, flowCx, flowCy)
    const nodeCx = x + NEW_CONCEPT_SIZE.width / 2
    const nodeCy = y + NEW_CONCEPT_SIZE.height / 2
    // Prevent the viewport-restore effect from overriding our setCenter below.
    viewportRestoredFor.current = useGraphStore.getState().currentGraphId
    addNode(x, y)
    track({ name: 'node_created' })
    setCenter(nodeCx, nodeCy, { zoom: Math.max(getViewport().zoom, 1), duration: 300 })
  }, [addNode, setCenter, getViewport, screenToFlowPosition, overlayInsets])

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
    // The selection exists here, so the inspector occupies space; the comfort
    // bounds are the shared insets expanded by the margin M.
    const panInsets = resolveCanvasInsets({
      sidebarWidth,
      inspectorPanelWidth,
      inspectorCollapsed,
      inspectorVisible: true,
    })
    const pan = computeSelectionPan({ left: wLeft, top: wTop, right: wRight, bottom: wBottom }, v, {
      left: panInsets.left - INSPECTOR_CANVAS_LEFT_GUTTER + M,
      right: window.innerWidth - panInsets.right - M,
      top: panInsets.top + M,
      bottom: window.innerHeight - panInsets.bottom - M,
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextControlFocused()) return
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
        topInset={overlayInsets.top}
        bottomInset={overlayInsets.bottom}
        leftInset={overlayInsets.left}
        rightInset={overlayInsets.right}
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
      />

      <RelationTypesDialog open={showRelationTypes} onClose={() => setShowRelationTypes(false)} />
      <Inspector
        panelWidth={inspectorPanelWidth}
        onPanelWidthChange={(w) => setInspectorPanelWidth(clampInspectorPanelWidth(w))}
      />
      <StatusBar sidebarWidth={sidebarWidth} onFit={fitView} />
      {mentorEnabled && (
        <MentorPanel leftInset={mentorInsets.left} rightInset={mentorInsets.right} />
      )}
      <ReviewMode open={showReview} onClose={() => setShowReview(false)} />
      {writingModeNodeId !== null && (
        <WritingMode nodeId={writingModeNodeId} onClose={closeWritingMode} />
      )}
      <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AboutDialog
        open={showAbout}
        onClose={() => setShowAbout(false)}
        onShowTutorial={() => {
          setShowAbout(false)
          onboarding.startTour()
        }}
      />
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectNode={handleSelectNode}
        onSelectGraph={(id) => loadGraph(id)}
      />
      <WelcomeDialog
        open={onboarding.phase === 'welcome'}
        onShowMeHow={onboarding.startTour}
        onSkipIntro={onboarding.skipOnboarding}
      />
      {onboarding.phase === 'tour' && !showReview && (
        <CoachmarkOverlay
          stepIndex={onboarding.tourStep}
          onSkip={onboarding.skipOnboarding}
          onNext={onboarding.advanceTour}
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
        <ReviewReminderBanner
          onStartReview={openReview}
          onboardingActive={onboarding.phase !== 'idle'}
        />
        <TelemetryConsentBanner
          open={onboarding.phase === 'consent'}
          onDismiss={onboarding.finishOnboarding}
        />
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
