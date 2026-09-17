// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'
import { useGraphStore } from '@/store'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { track } from '@/telemetry'
import { useT } from '@/i18n'
import { confirm } from '@/components/ui/confirm'
import { Icon } from '@/components/ui/icons'
import { hoverStyle } from '@/lib/hoverStyle'
import { iconBtn, sectionLabel } from './sidebarStyles'

/** Graphs section: switch / delete / rename. Owns its rename + hover state
 *  exclusively (moved verbatim from Sidebar); subscribes directly to the
 *  graph-list data it renders. */
export function SidebarGraphsSection() {
  const t = useT()
  const graphList = useGraphStore((s) => s.graphList)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const createGraph = useGraphStore((s) => s.createGraph)
  const renameGraph = useGraphStore((s) => s.renameGraph)
  const deleteGraph = useGraphStore((s) => s.deleteGraph)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    <>
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
          data-onboarding={isOnboardingStep(onboardingStep, 'new-graph') ? 'new-graph' : undefined}
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
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '11.5px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
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
                    {...hoverStyle({ color: 'var(--cat-opposition)' }, { color: 'var(--ink-4)' })}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            )
          })}
      </div>
    </>
  )
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
