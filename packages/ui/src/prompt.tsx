import { Dialog } from '@base-ui/react/dialog'
import { useId, useState, type ReactNode } from 'react'
import { Button } from './button'
import { DialogActions, DialogPopup } from './dialog'
import { Input } from './input'
import { Label } from './label'

export function PromptForm({ initialValue = '', nameLabel, submitLabel, cancelLabel, maxLength, onSubmit }: {
  initialValue?: string
  nameLabel: string
  submitLabel: string
  cancelLabel: string
  maxLength?: number
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const id = useId()
  return (
    <form className="mt-6" onSubmit={(event) => {
      event.preventDefault()
      if (value.trim()) onSubmit(value)
    }}>
      <Label htmlFor={id}>{nameLabel}</Label>
      <Input id={id} value={value} onChange={(event) => setValue(event.target.value)} onFocus={(event) => event.target.select()} maxLength={maxLength} className="mt-2" />
      <DialogActions>
        <Dialog.Close render={<Button variant="outline" />}>{cancelLabel}</Dialog.Close>
        <Button type="submit" disabled={!value.trim()}>{submitLabel}</Button>
      </DialogActions>
    </form>
  )
}

export function TextPromptDialog({ open, onOpenChange, title, description, initialValue, nameLabel, submitLabel, cancelLabel, maxLength, onSubmit, finalFocus, trigger }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initialValue?: string
  nameLabel: string
  submitLabel: string
  cancelLabel: string
  maxLength?: number
  onSubmit: (value: string) => void
  finalFocus?: Dialog.Popup.Props['finalFocus']
  trigger?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogPopup finalFocus={finalFocus}>
        <Dialog.Title className="text-sm">{title}</Dialog.Title>
        <Dialog.Description className="mt-2 text-xs text-muted-foreground">{description}</Dialog.Description>
        <PromptForm initialValue={initialValue} nameLabel={nameLabel} submitLabel={submitLabel} cancelLabel={cancelLabel} maxLength={maxLength} onSubmit={onSubmit} />
      </DialogPopup>
    </Dialog.Root>
  )
}
