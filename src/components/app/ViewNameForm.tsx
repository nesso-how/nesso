import { useId, useState } from 'react'
import { Button, Dialog, Input, Label } from '@nesso/ui'
import { maxViewNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

export function ViewNameForm({ initialName = '', submitLabel, onSubmit }: {
  initialName?: string
  submitLabel: string
  onSubmit: (name: string) => void
}) {
  const t = useTranslation()
  const [name, setName] = useState(initialName)
  const nameId = useId()

  return (
    <form className="mt-6" onSubmit={(event) => {
      event.preventDefault()
      if (name.trim()) onSubmit(name)
    }}>
      <Label htmlFor={nameId}>{t('name')}</Label>
      <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} onFocus={(event) => event.target.select()} maxLength={maxViewNameLength} className="mt-2" />
      <div className="mt-6 flex justify-end gap-2">
        <Dialog.Close render={<Button variant="outline" />}>{t('cancel')}</Dialog.Close>
        <Button type="submit" disabled={!name.trim()}>{submitLabel}</Button>
      </div>
    </form>
  )
}
