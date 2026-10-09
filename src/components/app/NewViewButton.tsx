import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, TextPromptDialog } from '@nesso/ui'
import { host } from '@/store'
import { maxViewNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

export function NewViewButton({ ref }: { ref?: Ref<HTMLButtonElement> }) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])

  return (
    <TextPromptDialog trigger={
      <Dialog.Trigger ref={ref} render={<Button
        variant="ghost"
        className="mb-3 w-full justify-start"
        aria-label={t('newView')}
      />}>
        <LayersPlus />
        {t('newView')}
      </Dialog.Trigger>
    } open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        setConceptIds(host.store.getState().selected.filter((item) => item.kind === 'concept').map((item) => item.id))
      }
      setOpen(nextOpen)
    }} title={t('newView')} description={conceptIds.length ? t('newViewSelection', { count: conceptIds.length }) : t('newViewEmpty')} initialValue="" nameLabel={t('name')} submitLabel={t('createView')} cancelLabel={t('cancel')} maxLength={maxViewNameLength} onSubmit={(name) => {
      host.store.createView(name, conceptIds)
      setOpen(false)
    }} />
  )
}
