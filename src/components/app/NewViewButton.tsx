import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, TextPromptDialog } from '@nesso-how/ui'
import { viewPositions } from '@nesso-how/knowledge-graph/layout'
import { newIri } from '@nesso-how/schema'
import { host } from '@/store'
import { maxViewNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

export function NewViewButton({
  ref,
  disabled = false,
}: {
  ref?: Ref<HTMLButtonElement>
  disabled?: boolean
}) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [conceptIds, setConceptIds] = useState<readonly string[]>([])

  return (
    <TextPromptDialog
      trigger={
        <Dialog.Trigger
          ref={ref}
          disabled={disabled}
          render={
            <Button variant="ghost" className="w-full justify-start" aria-label={t('newView')} />
          }
        >
          <LayersPlus />
          {t('newView')}
        </Dialog.Trigger>
      }
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setConceptIds(
            host.store
              .getState()
              .selected.filter((item) => item.kind === 'concept')
              .map((item) => item.id),
          )
        }
        setOpen(nextOpen)
      }}
      title={t('newView')}
      description={
        conceptIds.length ? t('newViewSelection', { count: conceptIds.length }) : t('newViewEmpty')
      }
      initialValue=""
      nameLabel={t('name')}
      submitLabel={t('createView')}
      cancelLabel={t('cancel')}
      maxLength={maxViewNameLength}
      onSubmit={(name) => {
        const { store } = host
        const updates =
          store.getState().workspace.activeViewId === null
            ? viewPositions(store.knowledgeGraphLayout, conceptIds)
            : []
        store.applyOperations([
          { kind: 'view.create', id: newIri(), name, conceptIds },
          ...(updates.length ? [{ kind: 'concept.positions' as const, updates }] : []),
        ])
        setOpen(false)
      }}
    />
  )
}
