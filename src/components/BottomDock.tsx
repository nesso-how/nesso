// SPDX-License-Identifier: MIT
import { useT } from '@/i18n'
import { focusFlowNodes } from '@/lib/focusFlowSelection'
import { useGraphStore } from '@/store/graph'

interface Props {
  onFit: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onAddConcept: () => void
  sidebarWidth?: number
}

export function BottomDock({
  onFit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAddConcept,
  sidebarWidth = 0,
}: Props) {
  const t = useT()
  const edges = useGraphStore((s) => s.edges)
  const selected = useGraphStore((s) => s.selected)
  const selectedIds = useGraphStore((s) => s.selectedIds)
  const deleteSelection = useGraphStore((s) => s.deleteSelection)
  const copySelection = useGraphStore((s) => s.copySelection)
  const pasteSelection = useGraphStore((s) => s.pasteSelection)
  const pasteAvailable = useGraphStore((s) => s.pasteAvailable)
  const hasEdgeSelection = edges.some((e) => e.selected)
  const canCopy =
    selected?.kind === 'edge' ||
    selected?.kind === 'node' ||
    selectedIds.length > 0 ||
    hasEdgeSelection
  const canDelete = canCopy
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(50% + ${sidebarWidth / 2}px)`,
        bottom: 18,
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-elev)',
        border: '0.5px solid var(--line)',
        borderRadius: 999,
        padding: 6,
        boxShadow: 'var(--shadow-md)',
        transition: 'left 180ms ease',
      }}
    >
      <DockBtn onClick={onUndo} title={t.bottomDock.undoTitle} disabled={!canUndo}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7H11a3 3 0 0 1 0 6H8" />
          <path d="M6 4L3 7l3 3" />
        </svg>
      </DockBtn>
      <DockBtn onClick={onRedo} title={t.bottomDock.redoTitle} disabled={!canRedo}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 7H5a3 3 0 0 0 0 6h3" />
          <path d="M10 4l3 3-3 3" />
        </svg>
      </DockBtn>

      <Sep />

      {/* Edit group: copy · paste · delete */}
      <DockBtn onClick={copySelection} title={t.bottomDock.copyTitle} disabled={!canCopy}>
        {/* two overlapping rects: back rect (3 sides), front rect — spans x:2–14, y:3–13 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="6" y="5" width="8" height="8" rx="1" />
          <path d="M11 5V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
        </svg>
      </DockBtn>
      <DockBtn
        onClick={() => {
          const ids = pasteSelection()
          if (ids?.length) focusFlowNodes(ids)
        }}
        title={t.bottomDock.pasteTitle}
        disabled={!pasteAvailable}
      >
        {/* clipboard: wide body + rounded tab — spans x:3–13, y:3–14 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="10" height="9" rx="1" />
          <path d="M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
        </svg>
      </DockBtn>
      <DockBtn onClick={deleteSelection} title={t.bottomDock.deleteTitle} disabled={!canDelete}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" />
        </svg>
      </DockBtn>

      <Sep />

      <DockBtn onClick={onFit} title={t.bottomDock.fitTitle}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />
        </svg>
      </DockBtn>

      <Sep />

      <DockBtn onClick={onAddConcept} title={t.bottomDock.addConceptTitle}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
      </DockBtn>
    </div>
  )
}

function Sep() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: 'var(--line)',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function DockBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="dock-btn"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        onClick?.()
        e.currentTarget.blur()
      }}
    >
      {children}
    </button>
  )
}
