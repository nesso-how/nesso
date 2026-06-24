// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef } from 'react'
import { NessoGraph } from '@nesso-how/graph'
import { useReactFlow, useStore } from '@xyflow/react'
import type { NessoGraphDocumentInput } from '@nesso-how/vocab-learning'

export interface HeroGraphLabels {
  understanding: string
  mastery: string
  knowledge: string
  inquiry: string
  passiveConsumption: string
  mind: string
}

function buildGraph(labels: HeroGraphLabels): NessoGraphDocumentInput {
  return {
    name: 'hero',
    concepts: [
      { id: 'understanding', label: labels.understanding, x: 355, y: 180 },
      { id: 'mastery', label: labels.mastery, x: 380, y: 20 },
      { id: 'knowledge', label: labels.knowledge, x: 620, y: 90 },
      { id: 'inquiry', label: labels.inquiry, x: 580, y: 340 },
      { id: 'passive-consumption', label: labels.passiveConsumption, x: 120, y: 340 },
      { id: 'mind', label: labels.mind, x: 80, y: 90 },
    ],
    relations: [
      { id: 'e-mastery', source: 'understanding', target: 'mastery', type: 'produces' },
      { id: 'e-knowledge', source: 'understanding', target: 'knowledge', type: 'supported-by' },
      { id: 'e-inquiry', source: 'understanding', target: 'inquiry', type: 'requires' },
      {
        id: 'e-passive',
        source: 'understanding',
        target: 'passive-consumption',
        type: 'contrasts-with',
      },
      { id: 'e-mind', source: 'understanding', target: 'mind', type: 'occurs-in' },
    ],
  }
}

function graphLabelsKey(labels: HeroGraphLabels): string {
  return Object.values(labels).join('\0')
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
  const graph = useMemo(() => buildGraph(labels), [labels])

  return (
    <NessoGraph
      key={graphLabelsKey(labels)}
      graph={graph}
      display={{ showHeatmap: false, edgeEncoding: 'full', curveStyle: 'straight' }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={false}
      fitView
      reactFlowProps={{
        proOptions: { hideAttribution: true },
        style: { background: 'transparent' },
        zoomOnDoubleClick: false,
        zoomOnPinch: false,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <FitViewOnResize />
    </NessoGraph>
  )
}
