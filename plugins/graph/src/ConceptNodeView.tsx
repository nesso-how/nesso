import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import type { ConceptNode } from './types'
import { conceptNodeSize } from './adapters'

export function ConceptNodeView({ data, selected }: NodeProps<ConceptNode>) {
  return (
    <div
      style={conceptNodeSize}
      className={cn(
        'flex items-center justify-center rounded-lg border bg-card px-4 text-sm font-normal transition-colors',
        selected ? 'border-primary shadow-[0_0_0_2px_var(--selection-halo)]' : 'border-node-border',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-2 !border-background !bg-(--handle)"
      />
      <span className="truncate px-1">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-background !bg-(--handle)"
      />
    </div>
  )
}
