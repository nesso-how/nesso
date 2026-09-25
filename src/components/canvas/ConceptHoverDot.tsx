// SPDX-License-Identifier: MIT
import { useCallback, useMemo, useState } from 'react'
import { Handle, Position, useConnection, useReactFlow } from '@xyflow/react'
import { useGraphStore } from '@/store'
import { CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { hoverDotCorner } from '@/lib/dotPlacement'
import type { DotEdge } from '@/lib/dotPlacement'

/**
 * Hover state for a concept's single connection dot. The dot sits on the
 * first free corner (top-left, bottom-left, top-right, bottom-right) and
 * hides while a connection drag is in flight — the shared dashed ring stays
 * as the destination highlight. Corner math lives in the tested
 * `dotPlacement` lib helpers; this hook only wires store and DOM.
 */
export function useHoverDot(nodeId: string) {
  const [hovered, setHovered] = useState(false)
  // Boolean selector: without it the node re-renders on each pointer move
  // while a connection gesture is in progress.
  const connecting = useConnection((c) => c.inProgress)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)
  const edges = useGraphStore((s) => s.edges)
  const curveStyle = useGraphStore((s) => s.graphDisplay.curveStyle)
  const { getNode } = useReactFlow()

  const onEnter = useCallback(() => setHovered(true), [])
  const onLeave = useCallback(() => setHovered(false), [])
  const corner = useMemo(
    () => hoverDotCorner(nodeId, getNode(nodeId), edges as DotEdge[], getNode, curveStyle ?? 'arc'),
    [curveStyle, edges, getNode, nodeId],
  )

  return {
    hovered,
    onEnter,
    onLeave,
    corner,
    dotVisible: hovered && !connecting,
    connectHandleAttr:
      isOnboardingStep(onboardingStep, 'connect-handle') && nodeId === firstNodeId
        ? ('connect-handle' as const)
        : undefined,
  }
}

/**
 * The concept's single hover dot: the drag origin for new arcs, on the first
 * free corner so it never covers an attached arc end. Ghost at rest and
 * solid on hover, like the arc endpoint dots (`EdgeEndpointDot`
 * inactive/active); the `:hover` swap is pure CSS so it costs no re-render.
 */
export function ConceptHoverDot({
  visible,
  corner,
  connectHandle,
}: {
  visible: boolean
  corner: { left: number; top: number }
  connectHandle: 'connect-handle' | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: corner.left,
        top: corner.top,
        transform: 'translate(-50%, -50%)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <Handle
        id={CONCEPT_HANDLE_OUT}
        type="source"
        position={Position.Right}
        className="nesso-node-handle"
        data-onboarding={connectHandle}
        style={{
          position: 'relative',
          left: 'auto',
          right: 'auto',
          top: 'auto',
          transform: 'none',
          width: 22,
          height: 22,
          border: 'none',
          borderRadius: 'var(--radius-circle)',
          cursor: 'crosshair',
        }}
      />
    </div>
  )
}
