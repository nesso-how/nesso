// SPDX-License-Identifier: MIT
import { useCallback, useRef, useState } from 'react'
import type { OnConnect, OnConnectStart, OnConnectEnd } from '@xyflow/react'
import { useGraphStore } from '@/store'
import type { RelationTypeName } from '@/types/graph'

export interface PendingConnection {
  source: string
  target: string
  screenX: number
  screenY: number
}

/**
 * Drag-to-connect state for the canvas: tracks the in-flight connection and the
 * pending source→target pair awaiting a relation type, then commits the edge.
 */
export function useConnectRelation() {
  const addEdge = useGraphStore((s) => s.addEdge)
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null)
  const connectingSource = useRef<string | null>(null)

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    connectingSource.current = params.nodeId ?? null
  }, [])

  const onConnectEnd = useCallback<OnConnectEnd>((event) => {
    // Restrict to node elements: edges and other React Flow chrome also carry
    // data-id, and an edge id here would persist a ghost edge with no target.
    const target = (event.target as Element)
      .closest('.react-flow__node[data-id]')
      ?.getAttribute('data-id')
    const source = connectingSource.current
    if (!source || !target || source === target) {
      connectingSource.current = null
      return
    }
    const e = event as MouseEvent
    setPendingConn({ source, target, screenX: e.clientX, screenY: e.clientY })
    connectingSource.current = null
  }, [])

  const onConnect = useCallback<OnConnect>((conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    setPendingConn({ source: conn.source, target: conn.target, screenX: 0, screenY: 0 })
  }, [])

  const onPickRelation = useCallback(
    (type: RelationTypeName) => {
      if (!pendingConn) return
      addEdge(pendingConn.source, pendingConn.target, type)
      setPendingConn(null)
    },
    [pendingConn, addEdge],
  )

  return { pendingConn, setPendingConn, onConnectStart, onConnectEnd, onConnect, onPickRelation }
}
