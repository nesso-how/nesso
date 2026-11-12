import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { contrastColor } from '@nesso-how/ui'
import { ConceptLabelEditor } from './ConceptLabelEditor'
import type { ConceptNode } from './types'
import { conceptNodeMinSize } from './adapters'
import { useCanvasContext } from './store'
import { useTranslation } from './i18n'

const activateHandle = (event: ReactKeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  const bounds = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: bounds.x + bounds.width / 2,
      clientY: bounds.y + bounds.height / 2,
    }),
  )
}

export function ConceptNodeView({ id, data, selected, isConnectable }: NodeProps<ConceptNode>) {
  const t = useTranslation()
  const { connection } = useCanvasContext()
  const canStart = selected && isConnectable && (!connection || connection.source === id)
  const canEnd = isConnectable && (!connection || connection.target === id)
  const connecting = useStore((state) =>
    state.connectionClickStartHandle
      ? state.connectionClickStartHandle.nodeId !== id
      : state.connection.inProgress && state.connection.fromNode.id !== id,
  )
  const editing = !!data.editable && !!data.editing
  const rootRef = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)

  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false
      rootRef.current?.focus({ preventScroll: true })
    }
  }, [editing])

  const startEditing = (event?: ReactMouseEvent) => {
    if (!data.editable || editing) return
    if (event && (event.target as Element).closest('.react-flow__handle')) return
    event?.stopPropagation()
    data.onEditingChange?.(id)
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      style={{
        minWidth: conceptNodeMinSize.width,
        height: conceptNodeMinSize.height,
        ...(data.color ? { background: data.color, color: contrastColor(data.color) } : {}),
      }}
      onClick={(event) => {
        if ((event.target as Element).closest('.react-flow__handle')) event.stopPropagation()
      }}
      onDoubleClick={startEditing}
      className={cn(
        'concept-node flex items-center justify-center rounded-[calc(var(--radius-object)+2px)] border bg-card px-3 py-1 text-[14px] leading-[18px] transition-[border-color,box-shadow] duration-(--duration-state) ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-(--handle)',
        data.bold ? 'font-semibold' : 'font-normal',
        data.italic && 'italic',
        selected
          ? 'border-primary shadow-[0_0_0_2px_var(--selection-halo)] duration-[180ms]'
          : 'border-node-border',
      )}
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
      <Handle
        id="target"
        type="target"
        position={Position.Top}
        isConnectable={canEnd}
        isConnectableStart={false}
        isConnectableEnd={canEnd}
        role="button"
        aria-label={t('connectTo', { name: data.label })}
        aria-hidden={!connecting || !canEnd}
        tabIndex={connecting && canEnd ? 0 : -1}
        onKeyDown={activateHandle}
        className={cn(
          'node-target !inset-0 !size-full !transform-none !border-0 opacity-0',
          !connecting && '!pointer-events-none',
        )}
      />
      {editing ? (
        <ConceptLabelEditor
          id={id}
          data={data}
          onFinish={(focus) => {
            refocus.current = focus
            data.onEditingChange?.(null)
          }}
        />
      ) : (
        <span className="whitespace-nowrap text-center">{data.label}</span>
      )}
      <Handle
        id="create"
        type="source"
        position={Position.Top}
        isConnectable={canStart}
        aria-label={t('connectFrom', { name: data.label })}
        role="button"
        aria-hidden={!canStart}
        tabIndex={canStart ? 0 : -1}
        onKeyDown={activateHandle}
        className={cn(
          'node-source !left-auto !right-0 !transform-none !translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent',
          !canStart && '!pointer-events-none opacity-0',
        )}
      />
    </div>
  )
}
