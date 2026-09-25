// SPDX-License-Identifier: MIT
import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icons'
import { useGraphStore } from '@/store'
import { useSelectedEdgeIsSymmetric } from '@/components/canvas/useSelectedEdgeIsSymmetric'
import { TOPBAR_HEIGHT_PX } from '@/components/layout/TopBar'
import { STATUS_BAR_HEIGHT_PX } from '@/components/layout/StatusBar'
import { useT } from '@/i18n'

export const INSPECTOR_RAIL_WIDTH = 52

export function InspectorIconBtn({
  icon,
  onClick,
  title,
  danger,
}: {
  icon: IconName
  onClick: () => void
  title: string
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        appearance: 'none',
        border: 0,
        width: 26,
        height: 26,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: hover ? (danger ? 'var(--cat-opposition)' : 'var(--ink)') : 'var(--ink-4)',
      }}
    >
      <Icon name={icon} />
    </button>
  )
}

/** Top row shared by both inspectors: collapse-to-rail (left) + deselect (right). */
export function InspectorCollapseCloseRow({ marginBottom }: { marginBottom: number }) {
  const t = useT()
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)
  const setSelected = useGraphStore((s) => s.setSelected)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom,
        marginLeft: -6,
        marginRight: -6,
      }}
    >
      <InspectorIconBtn
        icon="chevron-right"
        title={t.inspector.actions.collapse}
        onClick={() => setInspectorCollapsed(true)}
      />
      <InspectorIconBtn icon="close" title="Esc" onClick={() => setSelected(null)} />
    </div>
  )
}

/** Flip direction, shown only for directed relations (the caller hides it on symmetric ones). */
function FlipDirectionButton() {
  const t = useT()
  const reverseEdge = useGraphStore((s) => s.reverseEdge)
  const selected = useGraphStore((s) => s.selected)
  return (
    <InspectorIconBtn
      icon="flip"
      title={t.inspector.actions.flip}
      onClick={() => selected && reverseEdge(selected.id)}
    />
  )
}

/** Copy / cut / duplicate for a concept selection. */
function NodeClipboardActions() {
  const t = useT()
  const copySelection = useGraphStore((s) => s.copySelection)
  const cutSelection = useGraphStore((s) => s.cutSelection)
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection)
  return (
    <>
      <InspectorIconBtn
        icon="copy"
        title={t.inspector.actions.copy}
        onClick={() => copySelection()}
      />
      <InspectorIconBtn icon="cut" title={t.inspector.actions.cut} onClick={() => cutSelection()} />
      <InspectorIconBtn
        icon="duplicate"
        title={t.inspector.actions.duplicate}
        onClick={() => duplicateSelection()}
      />
    </>
  )
}

/** Bottom (or rail) action toolbar. Operates on the live selection via the store. */
export function InspectorActionToolbar({
  orientation = 'horizontal',
  includeClose = false,
}: {
  orientation?: 'horizontal' | 'vertical'
  includeClose?: boolean
}) {
  const t = useT()
  const selected = useGraphStore((s) => s.selected)
  const deleteSelection = useGraphStore((s) => s.deleteSelection)
  const setSelected = useGraphStore((s) => s.setSelected)

  const isEdge = selected?.kind === 'edge'
  // Reversing a symmetric relation (inverse === 'self') is a visual no-op.
  const symmetricEdge = useSelectedEdgeIsSymmetric()
  const vertical = orientation === 'vertical'

  const leading: ReactNode = isEdge ? (
    symmetricEdge ? null : (
      <FlipDirectionButton />
    )
  ) : (
    <NodeClipboardActions />
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: vertical ? 3 : 2,
      }}
    >
      {leading}
      {!vertical && <div style={{ flex: 1 }} />}
      <InspectorIconBtn
        icon="trash"
        danger
        title={isEdge ? t.inspector.actions.deleteRelation : t.inspector.actions.deleteConcept}
        onClick={() => deleteSelection()}
      />
      {includeClose && (
        <InspectorIconBtn icon="close" title="Esc" onClick={() => setSelected(null)} />
      )}
    </div>
  )
}

/** Collapsed 52px rail — keeps the selection alive, gives the canvas its width back. */
export function InspectorRail() {
  const t = useT()
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)

  return (
    <div
      data-chrome
      style={{
        position: 'absolute',
        top: TOPBAR_HEIGHT_PX,
        right: 0,
        bottom: STATUS_BAR_HEIGHT_PX,
        width: INSPECTOR_RAIL_WIDTH,
        zIndex: 25,
        background: 'var(--bg-card)',
        borderLeft: '0.5px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        boxSizing: 'border-box',
      }}
    >
      <InspectorIconBtn
        icon="chevron-left"
        title={t.inspector.actions.expand}
        onClick={() => setInspectorCollapsed(false)}
      />
      <div style={{ flex: 1 }} />
      <InspectorActionToolbar orientation="vertical" includeClose />
    </div>
  )
}
