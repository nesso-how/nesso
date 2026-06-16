// SPDX-License-Identifier: MIT
import { useState, type ReactNode } from 'react'
import { GlyphSVG } from '@nesso-how/graph'
import { RELATION_TYPES, RELATION_CATEGORIES, asEdgeTypeName } from '@/data/relationTypes'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store'
import { TOPBAR_HEIGHT_PX } from '@/components/layout/TopBar'
import { STATUS_BAR_HEIGHT_PX } from '@/components/layout/StatusBar'
import { useT } from '@/i18n'

export const INSPECTOR_RAIL_WIDTH = 52

type IconName =
  | 'copy'
  | 'cut'
  | 'duplicate'
  | 'trash'
  | 'flip'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'

function ChromeIcon({ name, size = 14 }: { name: IconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'copy':
      return (
        <svg {...p}>
          <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.6" />
          <path d="M10 5.5V4a1.2 1.2 0 0 0-1.2-1.2H4A1.2 1.2 0 0 0 2.8 4v4.8A1.2 1.2 0 0 0 4 10h1.5" />
        </svg>
      )
    case 'cut':
      return (
        <svg {...p}>
          <circle cx="4.2" cy="11.4" r="1.9" />
          <circle cx="4.2" cy="4.6" r="1.9" />
          <path d="M5.8 5.7L13 11.4M5.8 10.3L13 4.6" />
        </svg>
      )
    case 'duplicate':
      return (
        <svg {...p}>
          <rect x="5.8" y="5.8" width="7.2" height="7.2" rx="1.6" />
          <rect x="2.9" y="2.9" width="7.2" height="7.2" rx="1.6" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...p}>
          <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.6 8a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.6-8" />
        </svg>
      )
    case 'flip':
      return (
        <svg {...p}>
          <path d="M3.5 6.2h9l-2.4-2.4M12.5 9.8h-9l2.4 2.4" />
        </svg>
      )
    case 'close':
      return (
        <svg {...p}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg {...p}>
          <path d="M10 3.5L6 8l4 4.5" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg {...p}>
          <path d="M6 3.5L10 8l-4 4.5" />
        </svg>
      )
  }
}

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
        borderRadius: 7,
        cursor: 'default',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: hover ? (danger ? 'var(--cat-opposition)' : 'var(--ink)') : 'var(--ink-4)',
      }}
    >
      <ChromeIcon name={icon} />
    </button>
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
  const node = useGraphStore(selectedNodeSelector)
  const edge = useGraphStore(selectedEdgeSelector)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)

  const imageUrl = node?.data.elaboration?.imageUrl?.trim()
  // Node: only show the image thumbnail when one exists (no placeholder).
  // Edge: always show the relation glyph.
  let identity: ReactNode = null
  if (node && imageUrl) {
    identity = (
      <img
        src={imageUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    )
  } else if (edge) {
    const T = RELATION_TYPES[asEdgeTypeName(edge.data?.type)]
    const C = RELATION_CATEGORIES[T.cat]
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
            cursor: 'default',
            width: 32,
            height: 32,
            borderRadius: 8,
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
