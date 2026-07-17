// SPDX-License-Identifier: MIT
import { useState, type ReactNode } from 'react'
import { GlyphSVG } from '@nesso-how/graph'
import { Icon, type IconName } from '@/components/ui/icons'
import { RELATION_TYPES, RELATION_CATEGORY_COLORS, asRelationTypeName } from '@/data/relationTypes'
import { useGraphStore, selectedEdgeSelector } from '@/store'
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
  const copySelection = useGraphStore((s) => s.copySelection)
  const cutSelection = useGraphStore((s) => s.cutSelection)
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection)
  const deleteSelection = useGraphStore((s) => s.deleteSelection)
  const reverseEdge = useGraphStore((s) => s.reverseEdge)
  const setSelected = useGraphStore((s) => s.setSelected)

  const isEdge = selected?.kind === 'edge'
  const vertical = orientation === 'vertical'

  const leading: ReactNode = isEdge ? (
    <InspectorIconBtn
      icon="flip"
      title={t.inspector.actions.flip}
      onClick={() => selected && reverseEdge(selected.id)}
    />
  ) : (
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
  const edge = useGraphStore(selectedEdgeSelector)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)

  // Edge: always show the relation glyph.
  // Node: show nothing in the collapsed rail (just the chevron to re-expand).
  let identity: ReactNode = null
  if (edge) {
    const T = RELATION_TYPES[asRelationTypeName(edge.data?.type)]
    const C = RELATION_CATEGORY_COLORS[T.cat]
    identity = <GlyphSVG kind={T.glyph} color={C.color} size={16} />
  }

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
      {identity && (
        <button
          type="button"
          title={t.inspector.actions.expand}
          onClick={() => setInspectorCollapsed(false)}
          style={{
            marginTop: 12,
            appearance: 'none',
            border: 0,
            cursor: 'pointer',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
            background: 'var(--paper-deep)',
            boxShadow: 'inset 0 0 0 0.5px var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: 'var(--ink-3)',
          }}
        >
          {identity}
        </button>
      )}
      <div style={{ flex: 1 }} />
      <InspectorActionToolbar orientation="vertical" includeClose />
    </div>
  )
}
