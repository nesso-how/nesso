// SPDX-License-Identifier: MIT
import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { newConceptTopLeftAtFlowCenter } from '@/data/newConceptLayout'
import { focusFlowNodes } from '@/lib/focusFlowSelection'
import { Icon } from '@/components/ui/icons'

export type ContextMenuState = {
  x: number
  y: number
  kind: 'node' | 'edge' | 'canvas'
  flowX?: number
  flowY?: number
}

type CmIcon = 'copy' | 'cut' | 'duplicate' | 'trash' | 'paste' | 'add' | 'fit' | 'flip'

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
        borderRadius: 'var(--radius-md)',
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
        <Icon name={item.icon} size={15} />
      </span>
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
        {item.label}
      </span>
      {item.shortcut && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
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
        onClick: () => {
          const ids = pasteSelection({ x: menu.flowX ?? 0, y: menu.flowY ?? 0 })
          if (ids?.length) focusFlowNodes(ids)
        },
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
        borderRadius: 'var(--radius-lg)',
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
