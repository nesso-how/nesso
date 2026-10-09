import { Dialog } from '@base-ui/react/dialog'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import { Button } from './button'

export { Dialog }

export function DialogPopup({ className, ...props }: Dialog.Popup.Props) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop forceRender className="fixed inset-0 z-50 bg-foreground/20" />
      <Dialog.Popup className={cn('nesso-popup fixed top-1/2 left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-1/2 border-0 p-6', className)} {...props} />
    </Dialog.Portal>
  )
}

export function DialogActions({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>
}

export function ConfirmDialog({ open, onOpenChange, title, description, cancelLabel, confirmLabel, onConfirm, initialFocus, finalFocus, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  onConfirm: () => void
  initialFocus?: Dialog.Popup.Props['initialFocus']
  finalFocus?: Dialog.Popup.Props['finalFocus']
  children?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <DialogPopup initialFocus={initialFocus} finalFocus={finalFocus}>
        <Dialog.Title className="text-sm">{title}</Dialog.Title>
        <Dialog.Description className="mt-2 text-xs text-muted-foreground">{description}</Dialog.Description>
        {children}
        <DialogActions>
          <Dialog.Close render={<Button variant="outline" />}>{cancelLabel}</Dialog.Close>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </DialogActions>
      </DialogPopup>
    </Dialog.Root>
  )
}
