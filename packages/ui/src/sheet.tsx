import { Drawer } from '@base-ui/react/drawer'
import { cn } from 'cn'
import { X } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { IconButton } from './button'

export function BottomSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  popupRef,
  footer,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  closeLabel: string
  popupRef?: Ref<HTMLDivElement>
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      disablePointerDismissal
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-40 flex items-end pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          <Drawer.Popup
            ref={popupRef}
            className={cn('nesso-sheet pointer-events-auto', className)}
            initialFocus={false}
          >
            <div aria-hidden="true" className="nesso-sheet-handle" />
            <div className="flex shrink-0 items-center justify-between gap-2 pr-2 pl-5">
              <Drawer.Title className="nesso-sheet-title">{title}</Drawer.Title>
              <Drawer.Close
                render={
                  <IconButton
                    className="min-h-11 min-w-11"
                    aria-label={closeLabel}
                    title={closeLabel}
                  />
                }
              >
                <X />
              </Drawer.Close>
            </div>
            <Drawer.Content className="nesso-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
              {children}
            </Drawer.Content>
            {footer && <div className="nesso-sheet-footer">{footer}</div>}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
