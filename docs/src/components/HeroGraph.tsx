// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { NessoGraph } from '@nesso-how/graph'
import { useReactFlow, useStore } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import type { ConceptNodeData, NessoEdgeData } from '@nesso-how/types'

export interface HeroGraphLabels {
  understanding: string
  mastery: string
  knowledge: string
  inquiry: string
  passiveConsumption: string
  mind: string
}

const concept = (text: string): ConceptNodeData => ({
  text,
  stability: 1,
  difficulty: 1,
  reps: 0,
  lapses: 0,
  fsrsState: 0,
  due: 0,
  lastReview: 0,
  lastRating: 0,
})

function buildNodes(labels: HeroGraphLabels): Node<ConceptNodeData>[] {
  return [
    {
      id: 'understanding',
      type: 'concept',
      position: { x: 355, y: 180 },
      data: concept(labels.understanding),
    },
    { id: 'mastery', type: 'concept', position: { x: 380, y: 20 }, data: concept(labels.mastery) },
    {
      id: 'knowledge',
      type: 'concept',
      position: { x: 620, y: 90 },
      data: concept(labels.knowledge),
    },
    { id: 'inquiry', type: 'concept', position: { x: 580, y: 340 }, data: concept(labels.inquiry) },
    {
      id: 'passive-consumption',
      type: 'concept',
      position: { x: 120, y: 340 },
      data: concept(labels.passiveConsumption),
    },
    { id: 'mind', type: 'concept', position: { x: 80, y: 90 }, data: concept(labels.mind) },
  ]
}

function buildEdges(): Edge<NessoEdgeData>[] {
  return [
    {
      id: 'e-mastery',
      type: 'nesso',
      source: 'understanding',
      target: 'mastery',
      data: { type: 'produces' },
    },
    {
      id: 'e-knowledge',
      type: 'nesso',
      source: 'understanding',
      target: 'knowledge',
      data: { type: 'supported-by' },
    },
    {
      id: 'e-inquiry',
      type: 'nesso',
      source: 'understanding',
      target: 'inquiry',
      data: { type: 'requires' },
    },
    {
      id: 'e-passive',
      type: 'nesso',
      source: 'understanding',
      target: 'passive-consumption',
      data: { type: 'contrasts-with' },
    },
    {
      id: 'e-mind',
      type: 'nesso',
      source: 'understanding',
      target: 'mind',
      data: { type: 'occurs-in' },
    },
  ]
}

/**
 * Re-fits the viewport whenever the canvas resizes. ReactFlow's `fitView` prop only
 * fits once on mount; on a responsive page the container keeps changing size, so we
 * subscribe to the renderer dimensions (driven by ReactFlow's own ResizeObserver) and
 * re-fit on every change. Rendered inside <ReactFlow>, so the store hooks are in scope.
 */
function FitViewOnResize() {
  const { fitView } = useReactFlow()
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const mounted = useRef(false)

  useEffect(() => {
    // The `fitView` prop already handles the first fit once dimensions are known.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    void fitView()
  }, [width, height, fitView])

  return null
}

/** Decorative hero graph via @nesso-how/graph — nodes draggable, no connect UI. */
export function HeroGraph({ labels }: { labels: HeroGraphLabels }) {
  return (
    <NessoGraph
      defaultNodes={buildNodes(labels)}
      defaultEdges={buildEdges()}
      display={{ showHeatmap: false, edgeEncoding: 'full', curveStyle: 'straight' }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      fitView
      minZoom={0.2}
      maxZoom={1.4}
      reactFlowProps={{
        proOptions: { hideAttribution: true },
        style: { background: 'transparent' },
        zoomOnDoubleClick: false,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <FitViewOnResize />
    </NessoGraph>
  )
}
