// SPDX-License-Identifier: MIT
import { useMemo, useState, useEffect } from 'react'
import { useGraphStore } from '@/store/graph'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { GraphIO } from './GraphIO'
import { useT } from '@/i18n'

/** Full-height navbar; Inspector and canvas top inset rely on this. */
export const TOPBAR_HEIGHT_PX = 52

interface Props {
  sidebarCollapsed: boolean
  sidebarWidth: number
  onExpandSidebar: () => void
  onReview: () => void
  onRelationTypes: () => void
  onShortcuts: () => void
}

export function TopBar({
  sidebarCollapsed,
  sidebarWidth,
  onExpandSidebar,
  onReview,
  onRelationTypes,
  onShortcuts,
}: Props) {
  const t = useT()
  const { graphList, currentGraphId, nodes } = useGraphStore()
  const current = graphList.find((g) => g.id === currentGraphId)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const dueCount = useMemo(() => sortedDueConceptNodes(nodes).length, [nodes, now])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: sidebarWidth,
        right: 0,
        height: TOPBAR_HEIGHT_PX,
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        borderBottom: '0.5px solid var(--line)',
        background: 'var(--bg-elev)',
        transition: 'left 180ms ease',
      }}
    >
      {/* Left: expand sidebar (when collapsed) + graph title + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {sidebarCollapsed && (
          <button
            onClick={onExpandSidebar}
            title={t.topBar.expandSidebar}
            type="button"
            style={iconBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--paper-deep)'
              e.currentTarget.style.color = 'var(--ink)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--ink-3)'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M6 3v10" />
            </svg>
          </button>
        )}
        <h1
          style={{
            margin: 0,
            font: "500 16px 'Fraunces', ui-serif, Georgia, serif",
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}
        >
          {current?.name ?? '…'}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onReview}
          title={t.topBar.startReview}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            appearance: 'none',
            border: '0.5px solid var(--line)',
            background: 'var(--bg-card)',
            color: 'var(--ink-2)',
            borderRadius: 999,
            padding: '6px 12px',
            cursor: 'default',
            font: "500 12px 'Inter', ui-sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--paper-deep)'
            e.currentTarget.style.color = 'var(--ink)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)'
            e.currentTarget.style.color = 'var(--ink-2)'
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" />
            <path d="M2.5 4V2h2" />
          </svg>
          {t.topBar.review}
          {dueCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'var(--paper)',
                font: "600 10px 'JetBrains Mono', ui-monospace",
                padding: '0 4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-card)',
              }}
            >
              {dueCount > 99 ? '99+' : dueCount}
            </span>
          )}
        </button>
        <GraphIO onRelationTypes={onRelationTypes} onShortcuts={onShortcuts} />
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  width: 30,
  height: 30,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-3)',
  cursor: 'default',
}
