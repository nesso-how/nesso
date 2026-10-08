import { Dialog } from '@base-ui/react/dialog'
import { cn } from 'cn'

export { Dialog }

export function DialogPopup({ className, ...props }: Dialog.Popup.Props) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/20" />
      <Dialog.Popup className={cn('nesso-popup fixed top-1/2 left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-1/2 border-0 p-6', className)} {...props} />
    </Dialog.Portal>
  )
}
