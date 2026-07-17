// SPDX-License-Identifier: MIT
import { useCallback, useRef, useState } from 'react'
import type { OnConnect, OnConnectStart, OnConnectEnd } from '@xyflow/react'
import { useGraphStore } from '@/store'
import type { RelationTypeName } from '@/types/graph'
import { track } from '@/telemetry'

export interface PendingConnection {
  source: string
  target: string
  screenX: number
  screenY: number
}

type ConnectionHandleType = 'source' | 'target'

interface ConnectingStart {
  nodeId: string | null
  handleType: ConnectionHandleType | null
}

/**
 * Under ConnectionMode.Loose, React Flow silently swaps source/target in onConnect
 * when a connection starts from a target handle. Undo that swap so the user's
 * drag direction is preserved: source = drag start node, target = drag end node.
 */
function normalizeConnection(
  source: string,
  target: string,
  handleType: ConnectionHandleType | null,
): { source: string; target: string } {
  if (handleType === 'target') {
    return { source: target, target: source }
  }
  return { source, target }
}

/**
 * Drag-to-connect state for the canvas: tracks the in-flight connection and the
 * pending source→target pair awaiting a relation type, then commits the edge.
 */
export function useConnectRelation() {
  const addEdge = useGraphStore((s) => s.addEdge)
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null)
  const connectingStart = useRef<ConnectingStart>({ nodeId: null, handleType: null })
  const connectionAccepted = useRef(false)

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    connectionAccepted.current = false
    connectingStart.current = {
      nodeId: params.nodeId ?? null,
      handleType: (params.handleType as ConnectionHandleType | null) ?? null,
    }
  }, [])

  const onConnectEnd = useCallback<OnConnectEnd>((event) => {
    // If onConnect already handled this, skip the fallback.
    if (connectionAccepted.current) {
      connectionAccepted.current = false
      return
    }
    const target = (event.target as Element)
      .closest('.react-flow__node[data-id]')
      ?.getAttribute('data-id')
    const start = connectingStart.current
    if (!start.nodeId || !target || start.nodeId === target) {
      connectingStart.current = { nodeId: null, handleType: null }
      return
    }
    const normalized = normalizeConnection(start.nodeId, target, start.handleType)
    const e = event as MouseEvent
    setPendingConn({
      source: normalized.source,
      target: normalized.target,
      screenX: e.clientX,
      screenY: e.clientY,
    })
    connectingStart.current = { nodeId: null, handleType: null }
  }, [])

  const onConnect = useCallback<OnConnect>((conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    const start = connectingStart.current
    const normalized = normalizeConnection(conn.source, conn.target, start.handleType)
    connectionAccepted.current = true
    setPendingConn({
      source: normalized.source,
      target: normalized.target,
      screenX: 0,
      screenY: 0,
    })
    connectingStart.current = { nodeId: null, handleType: null }
  }, [])

  const onPickRelation = useCallback(
    (type: RelationTypeName) => {
      if (!pendingConn) return
      addEdge(pendingConn.source, pendingConn.target, type)
      track({ name: 'edge_created', props: { relation_type: type } })
      setPendingConn(null)
    },
    [pendingConn, addEdge],
  )

  return { pendingConn, setPendingConn, onConnectStart, onConnectEnd, onConnect, onPickRelation }
}
