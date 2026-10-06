import { Autocomplete } from '@base-ui/react/autocomplete'
import { cn } from 'cn'
import { X } from 'lucide-react'

export { Autocomplete }

export function AutocompletePopup({ className, children, ...props }: Autocomplete.Popup.Props) {
  return (
    <Autocomplete.Portal>
      <Autocomplete.Positioner sideOffset={4} className="z-50 outline-none">
        <Autocomplete.Popup className={cn('nesso-popup max-h-72 w-(--anchor-width) overflow-y-auto p-1', className)} {...props}>
          {children}
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  )
}

export function AutocompleteItem({ className, ...props }: Autocomplete.Item.Props) {
  return <Autocomplete.Item className={cn('nesso-option cursor-default px-2.5 py-2 text-xs', className)} {...props} />
}

export function AutocompleteClear({ className, children, ...props }: Autocomplete.Clear.Props) {
  return (
    <Autocomplete.Clear className={cn('nesso-button absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground', className)} {...props}>
      {children ?? <X className="size-3.5" />}
    </Autocomplete.Clear>
  )
}
