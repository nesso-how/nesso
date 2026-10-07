import { Menu } from '@base-ui/react/menu'
import { cn } from 'cn'
import { Check } from 'lucide-react'

export { Menu }

export function MenuPopup({ className, align = 'end', children, ...props }: Menu.Popup.Props & { align?: Menu.Positioner.Props['align'] }) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={4} className="z-50">
        <Menu.Popup className={cn('nesso-popup min-w-40 p-1', className)} {...props}>
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function MenuItem({ className, ...props }: Menu.Item.Props) {
  return <Menu.Item className={cn('nesso-option cursor-default px-2.5 py-2 text-xs', className)} {...props} />
}

export function MenuRadioItem({ className, children, ...props }: Menu.RadioItem.Props) {
  return (
    <Menu.RadioItem className={cn('nesso-option flex cursor-default items-center gap-2 px-2.5 py-2 text-xs', className)} {...props}>
      <span className="size-3.5"><Menu.RadioItemIndicator><Check className="size-3.5" /></Menu.RadioItemIndicator></span>
      {children}
    </Menu.RadioItem>
  )
}
