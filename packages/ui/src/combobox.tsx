import { Combobox } from '@base-ui/react/combobox'
import { cn } from 'cn'

export { Combobox }

export function ComboboxPopup({ className, children, ...props }: Combobox.Popup.Props) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner align="start" sideOffset={4} className="z-50">
        <Combobox.Popup className={cn('nesso-popup w-(--anchor-width) p-1', className)} {...props}>
          {children}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  )
}

export function ComboboxItem({ className, ...props }: Combobox.Item.Props) {
  return <Combobox.Item className={cn('nesso-option cursor-default px-2.5 py-2', className)} {...props} />
}
