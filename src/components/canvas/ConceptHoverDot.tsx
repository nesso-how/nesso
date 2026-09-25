// SPDX-License-Identifier: MIT
import { useCallback, useRef, useState } from 'react'
import { Handle, Position, useConnection, useReactFlow } from '@xyflow/react'
import { useGraphStore } from '@/store'
import { CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { hoverDotBox, hoverDotOffset } from '@/lib/hoverDot'

/**
 * Hover state for a concept's single connection dot. The dot sits on the
 * pill border nearest the cursor (ref-positioned, so no re-render per
 * pointer move) and hides while a connection drag is in flight — the shared
 * dashed ring stays as the destination highlight. Border math lives in the
 * tested `hoverDot` lib helpers; this hook only wires DOM and flow plumbing.
 */
export function useHoverDot(nodeId: string) {
  const [hovered, setHovered] = useState(false)
  // Boolean selector: without it the node re-renders on each pointer move
  // while a connection gesture is in progress.
  const connecting = useConnection((c) => c.inProgress)
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)
  const dotRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, getNode } = useReactFlow()

  const onEnter = useCallback(() => setHovered(true), [])
  const onLeave = useCallback(() => setHovered(false), [])
  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const wrap = dotRef.current
      if (!wrap || connecting) return
      const offset = hoverDotOffset(
        hoverDotBox(getNode(nodeId), { w: 80, h: 32 }),
        screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      )
      wrap.style.left = `${offset.left}px`
      wrap.style.top = `${offset.top}px`
    },
    [connecting, getNode, nodeId, screenToFlowPosition],
  )

  return {
    hovered,
    dotRef,
    onEnter,
    onLeave,
    onMove,
    dotVisible: hovered && !connecting,
    connectHandleAttr:
      isOnboardingStep(onboardingStep, 'connect-handle') && nodeId === firstNodeId
        ? ('connect-handle' as const)
        : undefined,
  }
}

/**
 * The concept's single hover dot: the drag origin for new arcs. Ghost at
 * rest and solid on hover, like the arc endpoint dots (`EdgeEndpointDot`
 * inactive/active); the `:hover` swap is pure CSS so it costs no re-render.
 */
export function ConceptHoverDot({
  visible,
  dotRef,
  connectHandle,
}: {
  visible: boolean
  dotRef: React.RefObject<HTMLDivElement>
  connectHandle: 'connect-handle' | undefined
}) {
  return (
    <div
      ref={dotRef}
      style={{
        position: 'absolute',
        left: '100%',
        top: '50%',
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
