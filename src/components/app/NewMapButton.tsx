import { useState, type Ref } from 'react'
import { LayersPlus } from 'lucide-react'
import { Button, Dialog, TextPromptDialog } from '@nesso-how/ui'
import { mapPositions } from '@nesso-how/knowledge-graph/layout'
import { newIri } from '@nesso-how/schema'
import { host } from '@/store'
import { maxMapNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

export function NewMapButton({
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
            <Button variant="ghost" className="w-full justify-start" aria-label={t('newMap')} />
          }
        >
          <LayersPlus />
          {t('newMap')}
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
      title={t('newMap')}
      description={
        conceptIds.length ? t('newMapSelection', { count: conceptIds.length }) : t('newMapEmpty')
      }
      initialValue=""
      nameLabel={t('name')}
      submitLabel={t('createMap')}
      cancelLabel={t('cancel')}
      maxLength={maxMapNameLength}
      onSubmit={(name) => {
        const { store } = host
        const updates =
          store.getState().workspace.activeMapId === null
            ? mapPositions(store.knowledgeGraphLayout, conceptIds)
            : []
        store.applyOperations([
          { kind: 'map.create', id: newIri(), name, conceptIds },
          ...(updates.length ? [{ kind: 'concept.positions' as const, updates }] : []),
        ])
        setOpen(false)
      }}
    />
  )
}
