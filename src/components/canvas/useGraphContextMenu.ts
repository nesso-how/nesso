// SPDX-License-Identifier: MIT
import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useReactFlow, type Node, type Edge } from '@xyflow/react'
import { useGraphStore } from '@/store'
import type { ContextMenuState } from './GraphContextMenu'

/** Right-click menu state plus node / edge / pane handlers for the graph canvas. */
export function useGraphContextMenu() {
  const setSelected = useGraphStore((s) => s.setSelected)
  const { screenToFlowPosition } = useReactFlow()
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      event.preventDefault()
      setSelected({ kind: 'node', id: node.id })
      setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'node' })
    },
    [setSelected],
  )

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.preventDefault()
      setSelected({ kind: 'edge', id: edge.id })
      setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'edge' })
    },
    [setSelected],
  )

  const onPaneContextMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      event.preventDefault()
      const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setCtxMenu({ x: event.clientX, y: event.clientY, kind: 'canvas', flowX: x, flowY: y })
    },
    [screenToFlowPosition],
  )

  return { ctxMenu, closeCtxMenu, onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu }
}
