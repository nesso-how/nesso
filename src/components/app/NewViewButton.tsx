import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, DialogPopup } from '@nesso/ui'
import { host } from '@/store'
import { ViewNameForm } from './ViewNameForm'
import { useTranslation } from '@/i18n'

export function NewViewButton({ ref }: { ref?: Ref<HTMLButtonElement> }) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        setConceptIds(host.store.getState().selected.filter((item) => item.kind === 'concept').map((item) => item.id))
      }
      setOpen(nextOpen)
    }}>
      <Dialog.Trigger ref={ref} render={<Button
        variant="ghost"
        className="mb-3 w-full justify-start"
        aria-label={t('newView')}
      />}>
        <LayersPlus />
        {t('newView')}
      </Dialog.Trigger>
      <DialogPopup>
        <Dialog.Title className="text-sm">{t('newView')}</Dialog.Title>
        <Dialog.Description className="mt-2 text-xs text-muted-foreground">{conceptIds.length ? t('newViewSelection', { count: conceptIds.length }) : t('newViewEmpty')}</Dialog.Description>
        <ViewNameForm submitLabel={t('createView')} onSubmit={(name) => {
          host.store.createView(name, conceptIds)
          setOpen(false)
        }} />
      </DialogPopup>
    </Dialog.Root>
  )
}
