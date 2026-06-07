// SPDX-License-Identifier: MIT
import { NessoGraph } from '@nesso-how/graph'
import type { Edge, Node } from '@xyflow/react'
import type { ConceptNodeData, NessoEdgeData } from '@nesso-how/types'

import '@xyflow/react/dist/style.css'

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
      minZoom={0.6}
      maxZoom={1.4}
      reactFlowProps={{
        proOptions: { hideAttribution: true },
        style: { background: 'transparent' },
        zoomOnDoubleClick: false,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <></>
    </NessoGraph>
  )
}
