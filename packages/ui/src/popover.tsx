import { Popover } from '@base-ui/react/popover'
import { cn } from 'cn'

export { Popover }

export function PopoverPopup({
  className,
  anchor,
  align = 'start',
  sideOffset = 4,
  children,
  ...props
}: Popover.Popup.Props & Pick<Popover.Positioner.Props, 'align' | 'anchor' | 'sideOffset'>) {
  return (
    <Popover.Portal>
      <Popover.Positioner align={align} anchor={anchor} sideOffset={sideOffset} className="z-50">
        <Popover.Popup
          className={cn(
            'nesso-popup z-50 max-h-(--available-height) overflow-y-auto p-3 outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}
