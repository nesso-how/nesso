// SPDX-License-Identifier: MIT
import { useCallback, useState } from 'react'
import { Handle, Position, useConnection } from '@xyflow/react'
import { useGraphStore } from '@/store'
import { CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'

/**
 * Hover state for a concept's single connection dot. The dot sits fixed on
 * the top-left of the node border and hides while a connection drag is in
 * flight — the shared dashed ring stays as the destination highlight.
 */
export function useHoverDot(nodeId: string) {
  const [hovered, setHovered] = useState(false)
  // Boolean selector: without it the node re-renders on each pointer move
  // while a connection gesture is in progress.
  const connecting = useConnection((c) => c.inProgress)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)

  const onEnter = useCallback(() => setHovered(true), [])
  const onLeave = useCallback(() => setHovered(false), [])

  return {
    hovered,
    onEnter,
    onLeave,
    dotVisible: hovered && !connecting,
    connectHandleAttr:
      isOnboardingStep(onboardingStep, 'connect-handle') && nodeId === firstNodeId
        ? ('connect-handle' as const)
        : undefined,
  }
}

/**
 * The concept's single hover dot: the drag origin for new arcs, fixed on
 * the top-left of the node border. Ghost at rest and solid on hover, like
 * the arc endpoint dots (`EdgeEndpointDot` inactive/active); the `:hover`
 * swap is pure CSS so it costs no re-render.
 */
export function ConceptHoverDot({
  visible,
  connectHandle,
}: {
  visible: boolean
  connectHandle: 'connect-handle' | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
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
