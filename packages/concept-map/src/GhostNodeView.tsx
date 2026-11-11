import { Handle, Position, type NodeProps } from '@xyflow/react'
import { conceptNodeMinSize } from './adapters'
import { moreGhost } from './ghosts'
import type { ConceptNode } from './types'
import { useTranslation } from './i18n'

export function GhostNodeView({ id, data }: NodeProps<ConceptNode>) {
  const t = useTranslation()
  const more = id === moreGhost.id
  const label = more ? t('moreOutsideNeighbors') : t('addToView', { name: data.label })
  return (
    <button
      type="button"
      className="graph-ghost nodrag nopan"
      style={
        more
          ? { width: moreGhost.width, height: moreGhost.height }
          : { minWidth: conceptNodeMinSize.width, height: conceptNodeMinSize.height }
      }
      aria-label={label}
      title={label}
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
      {data.label}
    </button>
  )
}
