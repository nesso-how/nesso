// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { track } from '@/telemetry'
import { useHorizontalResize } from '@/hooks/useHorizontalResize'
import { useT } from '@/i18n'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { SettingRow } from '@/components/ui/SettingRow'
import { confirm } from '@/components/ui/confirm'
import { Icon } from '@/components/ui/icons'
import { SidebarHeatmapToggle } from '@/components/ui/HeatmapDisplayToggle'
import { hoverStyle } from '@/lib/hoverStyle'
import { NessoMark } from './NessoMark'
import { SidebarProjects } from './SidebarProjects'
import { TOPBAR_HEIGHT_PX } from './TopBar'
import { WEBSITE_URL } from '@/data/appInfo'
import { isDesktop } from '@/lib/isDesktop'
import { SIDEBAR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 380
export const SIDEBAR_DEFAULT_WIDTH = 248

export function clampSidebarWidth(w: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)))
}

export function readSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (raw == null) return SIDEBAR_DEFAULT_WIDTH
    return clampSidebarWidth(Number(raw))
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

export function writeSidebarWidth(w: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(w)))
  } catch {
    /* ignore */
  }
}

interface Props {
  collapsed: boolean
  onCollapse: () => void
  onSearch: () => void
  onSettings: () => void
  width: number
  onWidthChange: (w: number) => void
}

export function Sidebar({
  collapsed,
  onCollapse,
  onSearch,
  onSettings,
  width,
  onWidthChange,
}: Props) {
  const t = useT()
  const graphList = useGraphStore((s) => s.graphList)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const createGraph = useGraphStore((s) => s.createGraph)
  const renameGraph = useGraphStore((s) => s.renameGraph)
  const deleteGraph = useGraphStore((s) => s.deleteGraph)
  const graphDisplay = useGraphStore((s) => s.graphDisplay)
  const setGraphDisplay = useGraphStore((s) => s.setGraphDisplay)
  const sidebarDisplayOpen = useGraphStore((s) => s.sidebarDisplayOpen)
  const setSidebarDisplayOpen = useGraphStore((s) => s.setSidebarDisplayOpen)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isResizing, onResizeHandleMouseDown, onResizeHandleKeyDown } = useHorizontalResize(
    width,
    onWidthChange,
    clampSidebarWidth,
  )

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startRename = (id: string, name: string) => {
    setDraft(name)
    setEditingId(id)
  }

  const commitRename = () => {
    if (editingId && draft.trim()) {
      const g = graphList.find((x) => x.id === editingId)
      if (g && draft.trim() !== g.name) renameGraph(editingId, draft.trim())
    }
    setEditingId(null)
    setDraft('')
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraft('')
  }

  const handleNew = async () => {
    // During the tour, naming is its own step (double-click the graph), so don't
    // auto-open the rename here.
    const duringTourCreate = isOnboardingStep(useGraphStore.getState().onboardingStep, 'new-graph')
    const id = await createGraph(t.sidebar.untitled)
    track({ name: 'graph_created', props: { source: duringTourCreate ? 'onboarding' : 'sidebar' } })
    if (duringTourCreate) return
    setTimeout(() => {
      const g = useGraphStore.getState().graphList.find((x) => x.id === id)
      if (g) startRename(id, g.name)
    }, 50)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (graphList.length <= 1) return
    const name = graphList.find((g) => g.id === id)?.name ?? ''
    // Deleting also removes the file on disk and there is no undo — confirm first.
    const confirmed = await confirm({
      title: t.sidebar.deleteGraph,
      message: t.sidebar.deleteGraphConfirm.replace('{name}', name),
      confirmLabel: t.sidebar.deleteGraphConfirmCta,
      cancelLabel: t.common.cancel,
      tone: 'danger',
    })
    if (!confirmed) return
    deleteGraph(id)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: collapsed ? 0 : width,
        zIndex: 30,
        transition: isResizing ? 'none' : 'width 180ms ease',
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          background: 'var(--bg-elev)',
          borderRight: '0.5px solid var(--line)',
          borderTop: isDesktop() ? '0.5px solid var(--line)' : undefined,
        }}
      >
        <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div
            style={{
              height: TOPBAR_HEIGHT_PX,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-5)',
              borderBottom: '0.5px solid var(--line)',
              flexShrink: 0,
            }}
          >
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={t.sidebar.websiteLinkTitle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-5)',
                flexShrink: 0,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ flexShrink: 0, color: 'var(--ink)', lineHeight: 0 }} aria-hidden>
                <NessoMark size={26} />
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--text-xl)',
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                }}
              >
                Nesso
              </div>
            </a>
            <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
            <button
              onClick={onCollapse}
              title={t.sidebar.collapseSidebar}
              type="button"
              style={iconBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ink)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ink-3)'
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M10 4l-4 4 4 4" />
              </svg>
            </button>
          </div>

          {/* Search → ⌘K */}
          <div style={{ padding: '10px 12px 8px', flexShrink: 0 }}>
            <button
              onClick={onSearch}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 9,
                appearance: 'none',
                border: 0,
                background: 'var(--paper-deep)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--ink-4)',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L13 13" strokeLinecap="round" />
              </svg>
              {t.sidebar.search}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '10px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⌘K
              </span>
            </button>
          </div>

          {/* Scrollable body — block flow so sections stack naturally without flex pushing */}
          <div className="nesso-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Projects (desktop only) */}
            {isDesktop() && (
              <>
                <SidebarProjects />
                <div style={{ height: '0.5px', background: 'var(--line)', margin: '6px 12px' }} />
              </>
            )}

            {/* Graphs */}
            <div
              style={{
                padding: '10px 12px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={sectionLabel}>{t.sidebar.graphs}</span>
              <button
                data-testid="sidebar-new-graph"
                data-onboarding={
                  isOnboardingStep(onboardingStep, 'new-graph') ? 'new-graph' : undefined
                }
                title={t.sidebar.newGraphTitle}
                onClick={handleNew}
                style={graphsNewBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-3)'
                }}
              >
                <svg width="11" height="11" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                  <path
                    d="M5 1v8M1 5h8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{ fontSize: '11.5px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
                >
                  {t.sidebar.newGraph}
                </span>
              </button>
            </div>

            <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[...graphList]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((g) => {
                  const active = g.id === currentGraphId
                  const hovered = hoveredId === g.id
                  return (
                    <div
                      key={g.id}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: active
                          ? 'var(--paper-deep)'
                          : hovered
                            ? 'var(--paper-deep)'
                            : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={() => setHoveredId(g.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {g.id === currentGraphId &&
                        (isOnboardingStep(onboardingStep, 'name-graph') ||
                          isOnboardingStep(onboardingStep, 'delete-graph')) && (
                          <div
                            data-onboarding={
                              isOnboardingStep(onboardingStep, 'name-graph')
                                ? 'name-graph'
                                : 'delete-graph'
                            }
                            aria-hidden
                            style={{
                              position: 'absolute',
                              inset: 0,
                              pointerEvents: 'none',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          />
                        )}
                      {editingId === g.id ? (
                        <input
                          ref={inputRef}
                          data-testid="sidebar-graph-rename"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') cancelRename()
                          }}
                          style={{
                            flex: 1,
                            border: 0,
                            outline: 0,
                            background: 'transparent',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                            color: 'var(--ink)',
                            padding: '6px 9px',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => loadGraph(g.id)}
                          onDoubleClick={() => startRename(g.id, g.name)}
                          title={`${g.name} — ${t.sidebar.renameHint}`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            appearance: 'none',
                            border: 0,
                            background: 'transparent',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 9px',
                            cursor: 'pointer',
                            minWidth: 0,
                            font: active
                              ? "500 13px 'Inter', ui-sans-serif"
                              : "13px 'Inter', ui-sans-serif",
                            color: active ? 'var(--ink)' : 'var(--ink-2)',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 'var(--radius-pill)',
                              flexShrink: 0,
                              background: active ? 'var(--accent)' : 'var(--ink-5)',
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {g.name}
                          </span>
                        </button>
                      )}
                      {graphList.length > 1 && hovered && editingId !== g.id && (
                        <button
                          onClick={(e) => void handleDelete(g.id, e)}
                          title={t.sidebar.deleteGraph}
                          style={{
                            ...iconBtn,
                            marginRight: 4,
                            flexShrink: 0,
                            color: 'var(--ink-4)',
                          }}
                          {...hoverStyle(
                            { color: 'var(--cat-opposition)' },
                            { color: 'var(--ink-4)' },
                          )}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Display section — fixed above footer, outside scroll */}
          <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--line)' }}>
            <div style={{ padding: '10px 12px 8px' }}>
              <button
                onClick={() => setSidebarDisplayOpen(!sidebarDisplayOpen)}
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 0,
                  width: '100%',
                }}
              >
                <span style={sectionLabel}>{t.sidebar.display}</span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  style={{
                    opacity: 0.5,
                    transform: sidebarDisplayOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 150ms',
                  }}
                >
                  <path
                    d="M2 4l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {sidebarDisplayOpen && (
              <div style={{ padding: '0 12px 10px' }}>
                <SidebarHeatmapToggle />
                <SettingRow label={t.sidebar.displayOptions.edges}>
                  <SegmentedControl
                    options={[
                      { id: 'full', label: t.sidebar.displayOptions.full },
                      { id: 'category', label: t.sidebar.displayOptions.cat },
                      { id: 'minimal', label: t.sidebar.displayOptions.min },
                    ]}
                    value={graphDisplay.edgeEncoding}
                    onChange={(v) =>
                      setGraphDisplay('edgeEncoding', v as 'full' | 'category' | 'minimal')
                    }
                  />
                </SettingRow>
                <SettingRow label={t.sidebar.displayOptions.curve}>
                  <SegmentedControl
                    options={[
                      { id: 'arc', label: t.sidebar.displayOptions.arc },
                      { id: 'straight', label: t.sidebar.displayOptions.line },
                    ]}
                    value={graphDisplay.curveStyle}
                    onChange={(v) => setGraphDisplay('curveStyle', v as 'arc' | 'straight')}
                  />
                </SettingRow>
                {graphDisplay.curveStyle === 'arc' && (
                  <SettingRow label={t.sidebar.displayOptions.autoFlip}>
                    <Switch
                      value={graphDisplay.autoCurveFlip}
                      onChange={(v) => setGraphDisplay('autoCurveFlip', v)}
                    />
                  </SettingRow>
                )}
              </div>
            )}
          </div>

          {/* Footer — Settings */}
          <div
            style={{
              padding: '8px 8px',
              borderTop: '0.5px solid var(--line)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
              }}
            >
              <button
                type="button"
                onClick={onSettings}
                title={t.sidebar.settingsTitle}
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-3)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-3)'
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {t.sidebar.settings}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--ink-4)',
                  }}
                >
                  ⌘,
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resize handle — outside overflow:hidden wrapper so it can straddle the border */}
      {!collapsed && (
        <button
          type="button"
          aria-label="Resize sidebar"
          onMouseDown={onResizeHandleMouseDown}
          onKeyDown={onResizeHandleKeyDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -4,
            width: 8,
            cursor: 'col-resize',
            touchAction: 'none',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 26,
  height: 26,
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-3)',
  cursor: 'pointer',
}

const graphsNewBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  height: 24,
  borderRadius: 'var(--radius-sm)',
  padding: '0 7px 0 6px',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--ink-3)',
  cursor: 'pointer',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
  color: 'var(--ink-4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
