import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { newIri } from '@nesso/schema'
import { contrastColor } from '@nesso/ui'
import type { ConceptNode } from './types'
import { conceptNodeMinSize } from './adapters'
import { useCanvasContext } from './store'
import { useTranslation } from './i18n'

const activateHandle = (event: ReactKeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  const bounds = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 }))
}

export function ConceptNodeView({ id, data, selected, isConnectable }: NodeProps<ConceptNode>) {
  const t = useTranslation()
  const { store } = useCanvasContext()
  const zoom = useStore((state) => state.transform[2])
  const connecting = useStore((state) => state.connectionClickStartHandle
    ? state.connectionClickStartHandle.nodeId !== id
    : state.connection.inProgress && state.connection.fromNode.id !== id)
  const editing = !!data.editable && !!data.editing
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)

  useEffect(() => {
    if (!editing) {
      if (refocus.current) {
        refocus.current = false
        rootRef.current?.focus({ preventScroll: true })
      }
      return
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [editing])

  const startEditing = (event?: ReactMouseEvent) => {
    if (!data.editable || editing) return
    if (event && (event.target as Element).closest('.react-flow__handle')) return
    event?.stopPropagation()
    data.onEditingChange?.(id)
  }

  const commitEditing = (input: HTMLInputElement) => {
    data.onEditingChange?.(null)
    if (input.value === data.label) return
    try {
      store.applyOperations([{ kind: 'concept.label', id, value: input.value }], { historyGroup: newIri() })
    } catch {
      input.value = data.label
    }
  }

  const onEditKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter') { refocus.current = true; event.currentTarget.blur() }
    else if (event.key === 'Escape') { refocus.current = true; data.onEditingChange?.(null) }
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
      onClick={(event) => { if ((event.target as Element).closest('.react-flow__handle')) event.stopPropagation() }}
      onDoubleClick={startEditing}
      className={cn(
        'concept-node flex items-center justify-center rounded-lg border bg-card px-3 py-1 text-[13.5px] font-normal leading-[18px] hover:border-(--handle)',
        !data.color && 'transition-colors',
        selected ? 'border-primary shadow-[0_0_0_2px_var(--selection-halo)]' : 'border-node-border',
      )}
    >
      {Object.values(Position).map((position) => (
        <Handle key={position} id={position} type="source" position={position} isConnectable={false} className="!pointer-events-none opacity-0" />
      ))}
      <Handle id="target" type="target" position={Position.Top} isConnectable={isConnectable} isConnectableStart={false} isConnectableEnd={isConnectable} role="button" aria-label={t('connectTo', { name: data.label })} aria-hidden={!connecting || !isConnectable} tabIndex={connecting && isConnectable ? 0 : -1} onKeyDown={activateHandle} className={cn('node-target !inset-0 !size-full !transform-none !border-0 opacity-0', !connecting && '!pointer-events-none')} />
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={data.label}
          maxLength={data.maxLength}
          aria-label={t('editConceptLabel')}
          data-document-edit
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => commitEditing(event.currentTarget)}
          onKeyDown={onEditKeyDown}
          onDoubleClick={(event) => event.stopPropagation()}
          className="nodrag"
        />
      ) : (
        <span className="whitespace-nowrap text-center">{data.label}</span>
      )}
      <Handle
        id="create"
        type="source"
        position={Position.Top}
        isConnectable={selected && isConnectable}
        aria-label={t('connectFrom', { name: data.label })}
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
