// SPDX-License-Identifier: MIT
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ConceptNodeData } from '@nesso-how/vocab-learning'
import { ConceptNodeBody } from './ConceptNodeBody.js'
import { useGraphDisplay } from './context.js'

type ConceptNodeType = Node<ConceptNodeData>

const HIDDEN_HANDLE: React.CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  opacity: 0,
  pointerEvents: 'none',
}

export function ConceptNode({ data, selected, id }: NodeProps<ConceptNodeType>) {
  const { showHeatmap, dimUnconnectedOnSelect, selectedEdge } = useGraphDisplay()
  const dimmed =
    !!dimUnconnectedOnSelect &&
    !!selectedEdge &&
    selectedEdge.source !== id &&
    selectedEdge.target !== id

  return (
    <div style={{ position: 'relative' }}>
      <ConceptNodeBody
        text={data.text}
        selected={selected}
        showHeatmap={showHeatmap}
        lastRating={data.lastRating ?? 0}
        dimmed={dimmed}
      />
      <Handle id="out" type="source" position={Position.Right} style={HIDDEN_HANDLE} />
      <Handle id="in" type="target" position={Position.Left} style={HIDDEN_HANDLE} />
    </div>
  )
}
