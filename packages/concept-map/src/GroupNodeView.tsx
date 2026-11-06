import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConceptNode } from './types'

export function GroupNodeView({ data }: NodeProps<ConceptNode>) {
  return (
    <div
      className="relation-group nodrag nopan"
      style={{ cursor: data.editable ? 'move' : 'default' }}
      role="button"
      tabIndex={0}
      aria-label={data.label}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        data.onGroupSelect?.(data.members!)
      }}
    >
      {Object.values(Position).map((position) => (
        <Handle
          key={position}
          id={position}
          type="source"
          position={position}
          isConnectable={false}
          className="!pointer-events-none opacity-0"
        />
      ))}
    </div>
  )
}
