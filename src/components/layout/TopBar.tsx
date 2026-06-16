// SPDX-License-Identifier: MIT
import { useMemo, useState, useEffect } from 'react'
import { useGraphStore } from '@/store'
import { sortedDueConceptNodes } from '@/data/fsrsDueQueue'
import { GraphIO } from '@/components/dialogs/GraphIO'
import { useT } from '@/i18n'
import { isDesktop } from '@/lib/isDesktop'
import { useActiveProjectName } from '@/hooks/useActiveProjectName'

/** Full-height navbar; Inspector and canvas top inset rely on this. */
export const TOPBAR_HEIGHT_PX = 52

interface Props {
  sidebarCollapsed: boolean
  sidebarWidth: number
  onExpandSidebar: () => void
  onReview: () => void
  onRelationTypes: () => void
  onShortcuts: () => void
  onAbout: () => void
}

export function TopBar({
  sidebarCollapsed,
  sidebarWidth,
  onExpandSidebar,
  onReview,
  onRelationTypes,
  onShortcuts,
  onAbout,
}: Props) {
  const t = useT()
  const graphList = useGraphStore((s) => s.graphList)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const nodes = useGraphStore((s) => s.nodes)
  const current = graphList.find((g) => g.id === currentGraphId)
  const projectName = useActiveProjectName()
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
        zIndex: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        borderTop: isDesktop() ? '0.5px solid var(--line)' : undefined,
        borderBottom: '0.5px solid var(--line)',
        background: 'var(--bg-elev)',
        transition: 'left 180ms ease',
      }}
    >
      {/* Left: expand sidebar (when collapsed) + project / graph breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', minWidth: 0 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {projectName && (
            <>
              <span
                style={{
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-4)',
                  whiteSpace: 'nowrap',
                }}
              >
                {projectName}
              </span>
              <span style={{ color: 'var(--ink-5)' }}>/</span>
            </>
          )}
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {current?.name ?? '…'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onReview}
          title={t.topBar.startReview}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            appearance: 'none',
            border: '0.5px solid var(--line)',
            background: 'var(--bg-card)',
            color: 'var(--ink-2)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 11px',
            cursor: 'default',
            fontSize: '12.5px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
            <path d="M12.5 2.2V4.6h-2.4" />
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
                borderRadius: 'var(--radius-pill)',
                background: 'var(--highlight)',
                color: 'var(--paper)',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
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
        <GraphIO onRelationTypes={onRelationTypes} onShortcuts={onShortcuts} onAbout={onAbout} />
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
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-3)',
  cursor: 'default',
}
