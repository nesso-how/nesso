import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import type { KeyboardEvent } from 'react'
import type { ConceptNode } from './types'
import { conceptNodeMinSize } from './adapters'

const activateHandle = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  const bounds = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 }))
}

export function ConceptNodeView({ id, data, selected, isConnectable }: NodeProps<ConceptNode>) {
  const zoom = useStore((state) => state.transform[2])
  const connecting = useStore((state) => state.connectionClickStartHandle
    ? state.connectionClickStartHandle.nodeId !== id
    : state.connection.inProgress && state.connection.fromNode.id !== id)
  return (
    <div
      style={{ minWidth: conceptNodeMinSize.width, height: conceptNodeMinSize.height }}
      onClick={(event) => { if ((event.target as Element).closest('.react-flow__handle')) event.stopPropagation() }}
      className={cn(
        'concept-node flex items-center justify-center rounded-lg border bg-card px-3 py-1 text-sm font-medium leading-[18px] transition-colors hover:border-(--handle)',
        selected ? 'border-primary shadow-[0_0_0_2px_var(--selection-halo)]' : 'border-node-border',
      )}
    >
      {Object.values(Position).map((position) => (
        <Handle key={position} id={position} type="source" position={position} isConnectable={false} className="!pointer-events-none opacity-0" />
      ))}
      <Handle id="target" type="target" position={Position.Top} isConnectable={isConnectable} isConnectableStart={false} isConnectableEnd={isConnectable} role="button" aria-label={`Connect to ${data.label}`} aria-hidden={!connecting || !isConnectable} tabIndex={connecting && isConnectable ? 0 : -1} onKeyDown={activateHandle} className={cn('node-target !inset-0 !size-full !transform-none !border-0 opacity-0', !connecting && '!pointer-events-none')} />
      <span className="whitespace-nowrap text-center">{data.label}</span>
      <Handle
        id="create"
        type="source"
        position={Position.Top}
        isConnectable={selected && isConnectable}
        aria-label={`Connect from ${data.label}`}
        role="button"
        aria-hidden={!selected || !isConnectable}
        tabIndex={selected && isConnectable ? 0 : -1}
        onKeyDown={activateHandle}
        style={{ scale: 1 / zoom }}
        className={cn('node-source !left-auto !right-0 !transform-none !translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent', (!selected || !isConnectable) && '!pointer-events-none opacity-0')}
      />
    </div>
  )
}
