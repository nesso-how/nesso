import { Menu, MenuItem, MenuPopup } from '@nesso/ui'
import type { LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'

type Props = {
  position: { x: number; y: number } | null
  label: string
  onClose: () => void
  finalFocus: RefObject<HTMLDivElement | null>
  actions: readonly {
    label: string
    icon: LucideIcon
    onClick: () => void
    disabled?: boolean
  }[]
}

export function GraphContextMenu({ position, label, onClose, finalFocus, actions }: Props) {
  return (
    <Menu.Root open={position !== null} modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      {position && (
        <MenuPopup anchor={{ getBoundingClientRect: () => DOMRect.fromRect({ ...position, width: 0, height: 0 }) }} sideOffset={2} aria-label={label} finalFocus={finalFocus} onKeyDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
          {actions.map(({ label, icon: Icon, onClick, disabled }) => (
            <MenuItem key={label} onClick={onClick} disabled={disabled}>
              <Icon aria-hidden="true" />
              {label}
            </MenuItem>
          ))}
        </MenuPopup>
      )}
    </Menu.Root>
  )
}
