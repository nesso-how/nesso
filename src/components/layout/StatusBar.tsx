// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { useReactFlow, useStore as useFlowStore } from '@xyflow/react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { SocratesGlyph } from '@/components/mentor/SocratesGlyph'
import { FEEDBACK_URL, openExternal } from '@/data/appInfo'
import { track } from '@/telemetry'

export const STATUS_BAR_HEIGHT_PX = 30

interface Props {
  sidebarWidth: number
  onFit: () => void
}

type IconName = 'undo' | 'redo' | 'minus' | 'plus' | 'fit' | 'feedback'

function StatusIcon({ name }: { name: IconName }) {
  const p = {
    width: 13,
    height: 13,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'undo':
      return (
        <svg {...p}>
          <path d="M3 7h7a3 3 0 0 1 0 6H7" />
          <path d="M5.5 4.5L3 7l2.5 2.5" />
        </svg>
      )
    case 'redo':
      return (
        <svg {...p}>
          <path d="M13 7H6a3 3 0 0 0 0 6h3" />
          <path d="M10.5 4.5L13 7l-2.5 2.5" />
        </svg>
      )
    case 'minus':
      return (
        <svg {...p} strokeWidth={1.7}>
          <path d="M3 8h10" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...p} strokeWidth={1.7}>
          <path d="M8 3v10M3 8h10" />
        </svg>
      )
    case 'fit':
      return (
        <svg {...p}>
          <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />
        </svg>
      )
    case 'feedback':
      return (
        <svg {...p}>
          <path d="M3 4.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H6l-3 2.5V5.5a1 1 0 0 1 1-1z" />
        </svg>
      )
  }
}

function StatusBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        appearance: 'none',
        border: 0,
        height: 22,
        minWidth: 22,
        padding: '0 5px',
        borderRadius: 'var(--radius-sm)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: !disabled && hover ? 'var(--ink)' : 'var(--ink-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </button>
  )
}

/** Leaf subscriber: only this span re-renders while the viewport zooms. */
function ZoomReadout() {
  const zoom = useFlowStore((s) => s.transform[2])
  return (
    <span
      style={{
        fontSize: '10.5px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-3)',
        minWidth: 34,
        textAlign: 'center',
      }}
    >
      {Math.round(zoom * 100)}%
    </span>
  )
}

function SocratesEntry() {
  const t = useT()
  const open = useGraphStore((s) => s.mentorPanelExpanded)
  const setOpen = useGraphStore((s) => s.setMentorPanelExpanded)
  const [hover, setHover] = useState(false)
  const active = open || hover
  return (
    <button
      type="button"
      title={t.statusBar.socratesTitle}
      onClick={() => {
        if (!open) track({ name: 'mentor_session_started' })
        setOpen(!open)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        appearance: 'none',
        border: 0,
        height: 22,
        padding: '0 8px 0 6px',
        borderRadius: 'var(--radius-pill)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        cursor: 'pointer',
        background: active ? 'var(--paper-deep)' : 'transparent',
      }}
    >
      <span style={{ flexShrink: 0 }}>
        <SocratesGlyph size={18} />
      </span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: active ? 'var(--ink)' : 'var(--ink-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {t.mentor.name}
      </span>
    </button>
  )
}

const sep: React.CSSProperties = {
  width: 1,
  height: 14,
  background: 'var(--line)',
  flexShrink: 0,
  margin: '0 4px',
}

export function StatusBar({ sidebarWidth, onFit }: Props) {
  const t = useT()
  const nodeCount = useGraphStore((s) => s.nodes.length)
  const edgeCount = useGraphStore((s) => s.edges.length)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const canUndo = useGraphStore((s) => s._history.length > 0)
  const canRedo = useGraphStore((s) => s._future.length > 0)
  const { zoomIn, zoomOut } = useReactFlow()

  return (
    <div
      data-chrome
      style={{
        position: 'absolute',
        left: sidebarWidth,
        right: 0,
        bottom: 0,
        height: STATUS_BAR_HEIGHT_PX,
        zIndex: 25,
        transition: 'left 180ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        boxSizing: 'border-box',
        borderTop: '0.5px solid var(--line)',
        background: 'var(--bg-elev)',
        userSelect: 'none',
      }}
    >
      {/* Left — Socrates anchor + graph counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <SocratesEntry />
        <span style={sep} />
        <span
          style={{
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
            whiteSpace: 'nowrap',
          }}
        >
          {nodeCount} {t.statusBar.concepts} · {edgeCount} {t.statusBar.relations}
        </span>
      </div>

      {/* Right — feedback + history + viewport controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
        <StatusBtn
          onClick={() => void openExternal(FEEDBACK_URL)}
          title={t.statusBar.feedbackTitle}
        >
          <StatusIcon name="feedback" />
        </StatusBtn>
        <span style={sep} />
        <StatusBtn onClick={undo} disabled={!canUndo} title={t.statusBar.undoTitle}>
          <StatusIcon name="undo" />
        </StatusBtn>
        <StatusBtn onClick={redo} disabled={!canRedo} title={t.statusBar.redoTitle}>
          <StatusIcon name="redo" />
        </StatusBtn>
        <span style={sep} />
        <StatusBtn onClick={() => zoomOut({ duration: 200 })} title={t.statusBar.zoomOutTitle}>
          <StatusIcon name="minus" />
        </StatusBtn>
        <ZoomReadout />
        <StatusBtn onClick={() => zoomIn({ duration: 200 })} title={t.statusBar.zoomInTitle}>
          <StatusIcon name="plus" />
        </StatusBtn>
        <span style={sep} />
        <StatusBtn onClick={onFit} title={t.statusBar.fitTitle}>
          <StatusIcon name="fit" />
        </StatusBtn>
      </div>
    </div>
  )
}
