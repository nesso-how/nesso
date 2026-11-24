import { Menu } from '@base-ui/react/menu'
import { cn } from 'cn'
import { Check } from 'lucide-react'

export { Menu }
const menuItemClass =
  'nesso-option flex cursor-default items-center gap-2 px-2.5 py-2 data-disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

export function MenuPopup({
  className,
  align = 'start',
  anchor,
  side,
  sideOffset = 4,
  children,
  ...props
}: Menu.Popup.Props & Pick<Menu.Positioner.Props, 'align' | 'anchor' | 'side' | 'sideOffset'>) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        anchor={anchor}
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <Menu.Popup
          className={cn(
            'nesso-popup nesso-scroll w-max min-w-32 max-w-[calc(100vw-32px)] max-h-(--available-height) overflow-y-auto p-1',
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function MenuItem({ className, ...props }: Menu.Item.Props) {
  return <Menu.Item className={cn(menuItemClass, className)} {...props} />
}

export function MenuCheckboxItem({ className, ...props }: Menu.CheckboxItem.Props) {
  return <Menu.CheckboxItem className={cn(menuItemClass, className)} {...props} />
}

export function MenuSubmenuTrigger({ className, ...props }: Menu.SubmenuTrigger.Props) {
  return <Menu.SubmenuTrigger className={cn(menuItemClass, className)} {...props} />
}

export function MenuRadioItem({ className, children, ...props }: Menu.RadioItem.Props) {
  return (
    <Menu.RadioItem
      className={cn('nesso-option flex cursor-default items-center gap-2 px-2.5 py-2', className)}
      {...props}
    >
      <span className="size-3.5">
        <Menu.RadioItemIndicator>
          <Check className="size-3.5" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  )
}
