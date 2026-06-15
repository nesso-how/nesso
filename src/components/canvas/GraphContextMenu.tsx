// SPDX-License-Identifier: MIT
import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { newConceptTopLeftAtFlowCenter } from '@/data/newConceptLayout'

export type ContextMenuState = {
  x: number
  y: number
  kind: 'node' | 'edge' | 'canvas'
  flowX?: number
  flowY?: number
}

type CmIcon = 'copy' | 'cut' | 'duplicate' | 'trash' | 'paste' | 'add' | 'fit' | 'flip' | 'type'

function CmGlyph({ name }: { name: CmIcon }) {
  const p = {
    width: 15,
    height: 15,
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
    case 'paste':
      return (
        <svg {...p}>
          <rect x="3.3" y="3" width="9.4" height="11" rx="1.6" />
          <rect x="5.6" y="1.8" width="4.8" height="2.6" rx="0.9" />
        </svg>
      )
    case 'add':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5.6v4.8M5.6 8h4.8" />
        </svg>
      )
    case 'fit':
      return (
        <svg {...p}>
          <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />
        </svg>
      )
    case 'flip':
      return (
        <svg {...p}>
          <path d="M3.5 6.2h9l-2.4-2.4M12.5 9.8h-9l2.4 2.4" />
        </svg>
      )
    case 'type':
      return (
        <svg {...p}>
          <path d="M3 5.5h10M3 8h10M3 10.5h6" />
        </svg>
      )
  }
}

interface Item {
  icon: CmIcon
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

function MenuRow({ item, onClose }: { item: Item; onClose: () => void }) {
  const [hover, setHover] = useState(false)
  const ink = item.disabled ? 'var(--ink-5)' : item.danger ? 'var(--cat-opposition)' : 'var(--ink)'
  const iconColor = item.disabled
    ? 'var(--ink-5)'
    : item.danger
      ? 'var(--cat-opposition)'
      : 'var(--ink-4)'
  return (
    <button
      type="button"
      onMouseEnter={() => !item.disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (item.disabled) return
        item.onClick()
        onClose()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        appearance: 'none',
        border: 0,
        cursor: 'default',
        padding: '7px 9px 7px 10px',
        borderRadius: 8,
        background: hover && !item.disabled ? 'var(--paper-deep)' : 'transparent',
        color: ink,
      }}
    >
      <span
        style={{
          display: 'flex',
          width: 16,
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
          marginRight: 11,
        }}
      >
        <CmGlyph name={item.icon} />
      </span>
      <span style={{ flex: 1, font: "500 13px 'Inter', system-ui" }}>{item.label}</span>
      {item.shortcut && (
        <span
          style={{
            font: "500 11px 'JetBrains Mono', ui-monospace",
            color: item.disabled ? 'var(--ink-5)' : 'var(--ink-4)',
            flexShrink: 0,
            marginLeft: 14,
          }}
        >
          {item.shortcut}
        </span>
      )}
    </button>
  )
}

export function GraphContextMenu({
  menu,
  onClose,
  onFit,
}: {
  menu: ContextMenuState
  onClose: () => void
  onFit: () => void
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  const selected = useGraphStore((s) => s.selected)
  const pasteAvailable = useGraphStore((s) => s.pasteAvailable)
  const copySelection = useGraphStore((s) => s.copySelection)
  const cutSelection = useGraphStore((s) => s.cutSelection)
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection)
  const deleteSelection = useGraphStore((s) => s.deleteSelection)
  const pasteSelection = useGraphStore((s) => s.pasteSelection)
  const reverseEdge = useGraphStore((s) => s.reverseEdge)
  const addNode = useGraphStore((s) => s.addNode)
  const setInspectorCollapsed = useGraphStore((s) => s.setInspectorCollapsed)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const PAD = 8
    let left = menu.x
    let top = menu.y
    if (left + r.width + PAD > window.innerWidth)
      left = Math.max(PAD, window.innerWidth - r.width - PAD)
    if (top + r.height + PAD > window.innerHeight) top = Math.max(PAD, menu.y - r.height)
    setPos({ left, top })
  }, [menu.x, menu.y, menu.kind])

  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // Capture phase: React Flow stops mousedown propagation on nodes/pane, so a
    // bubble-phase window listener would miss clicks and the menu would linger.
    const id = setTimeout(() => window.addEventListener('mousedown', onDown, true), 0)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    return () => {
      clearTimeout(id)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('wheel', onClose)
    }
  }, [onClose])

  let items: (Item | 'sep')[]
  if (menu.kind === 'node') {
    items = [
      { icon: 'copy', label: t.contextMenu.copy, shortcut: '⌘C', onClick: () => copySelection() },
      { icon: 'cut', label: t.contextMenu.cut, shortcut: '⌘X', onClick: () => cutSelection() },
      {
        icon: 'duplicate',
        label: t.contextMenu.duplicate,
        shortcut: '⌘D',
        onClick: () => duplicateSelection(),
      },
      'sep',
      {
        icon: 'trash',
        label: t.contextMenu.delete,
        shortcut: '⌫',
        danger: true,
        onClick: () => deleteSelection(),
      },
    ]
  } else if (menu.kind === 'edge') {
    items = [
      {
        icon: 'type',
        label: t.contextMenu.changeType,
        onClick: () => setInspectorCollapsed(false),
      },
      {
        icon: 'flip',
        label: t.contextMenu.flip,
        onClick: () => selected && reverseEdge(selected.id),
      },
      'sep',
      {
        icon: 'trash',
        label: t.contextMenu.delete,
        shortcut: '⌫',
        danger: true,
        onClick: () => deleteSelection(),
      },
    ]
  } else {
    items = [
      {
        icon: 'paste',
        label: t.contextMenu.paste,
        shortcut: '⌘V',
        disabled: !pasteAvailable,
        onClick: () => pasteSelection(),
      },
      'sep',
      {
        icon: 'add',
        label: t.contextMenu.addHere,
        shortcut: 'N',
        onClick: () => {
          const p = newConceptTopLeftAtFlowCenter(menu.flowX ?? 0, menu.flowY ?? 0)
          addNode(p.x, p.y)
        },
      },
      'sep',
      { icon: 'fit', label: t.contextMenu.centerFit, shortcut: 'F', onClick: onFit },
    ]
  }

  return (
    <div
      ref={ref}
      data-chrome
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        minWidth: 212,
        zIndex: 1000,
        background: 'var(--bg-card)',
        border: '0.5px solid var(--line)',
        borderRadius: 12,
        padding: 5,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} style={{ height: 1, background: 'var(--line)', margin: '4px 7px' }} />
        ) : (
          <MenuRow key={i} item={it} onClose={onClose} />
        ),
      )}
    </div>
  )
}
