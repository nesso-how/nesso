import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import type { ConceptNode } from './types'

export function ConceptNodeView({ data, selected }: NodeProps<ConceptNode>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />
      <span className="px-1">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}
