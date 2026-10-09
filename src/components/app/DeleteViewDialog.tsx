import type { NessoOperation, SavedView } from '@nesso/plugin'
import { ConfirmDialog } from '@nesso/ui'
import { useRef, useState } from 'react'
import { newIri } from '@nesso/schema'
import { host, useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'

export function DeleteViewDialog({ target, onClose, finalFocus }: {
  target: SavedView | 'complete-graph' | null
  onClose: () => void
  finalFocus?: () => HTMLElement | null
}) {
  const t = useTranslation()
  const cancel = useRef<HTMLButtonElement>(null)
  const [withConcepts, setWithConcepts] = useState(true)
  const concepts = useNessoStore((state) => state.graph.concepts)
  const savedViews = useNessoStore((state) => state.workspace.savedViews)
  const complete = target === 'complete-graph'
  const exclusive = !complete && target
    ? target.conceptIds.filter((id) => concepts.some((concept) => concept.id === id) &&
      savedViews.every((view) => view.id === target.id || !view.conceptIds.includes(id)))
    : []
  const close = () => {
    setWithConcepts(true)
    onClose()
  }
  const clearGraph = () => {
    const operations: NessoOperation[] = [
      { kind: 'selection.set', value: [] },
      ...concepts.map((concept) => ({ kind: 'concept.remove' as const, id: concept.id })),
      ...savedViews.map((view) => ({ kind: 'view.remove' as const, id: view.id })),
      { kind: 'concept.add' as const, id: newIri() },
      { kind: 'selection.set' as const, value: [] },
    ]
    host.store.applyOperations(operations)
  }
  return (
    <ConfirmDialog open={target !== null} onOpenChange={(open) => { if (!open) close() }} title={t('deleteViewTitle', { name: complete ? t('completeGraph') : target?.name ?? '' })} description={t(complete ? 'resetConfirmation' : 'deleteViewDescription')} cancelLabel={t('cancel')} confirmLabel={t('deleteView')} initialFocus={cancel} finalFocus={finalFocus} onConfirm={() => {
      if (complete) clearGraph()
      else if (target) {
        if (withConcepts && exclusive.length > 0) {
          const operations: NessoOperation[] = [
            ...exclusive.map((conceptId) => ({ kind: 'concept.remove' as const, id: conceptId })),
            { kind: 'view.remove' as const, id: target.id },
          ]
          host.store.applyOperations(operations)
        } else host.store.deleteView(target.id)
      }
      close()
    }}>
      {exclusive.length > 0 && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={withConcepts} onChange={(event) => setWithConcepts(event.target.checked)} className="size-4 shrink-0 accent-primary" />
          {t('deleteViewConcepts')}
        </label>
      )}
    </ConfirmDialog>
  )
}
