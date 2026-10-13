import { Button, Combobox, ComboboxItem, ComboboxPopup, IconButton, Input } from '@nesso/ui'
import { Plus, X } from 'lucide-react'
import type { SavedView } from '@nesso/plugin'
import { useRef, useState } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { InspectorSection } from './InspectorSection'
import { useTranslation } from '@/i18n'

export function ConceptViews({ store = nessoStore, conceptIds, readonly = false }: { store?: HostStore; conceptIds: readonly string[]; readonly?: boolean }) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const memberships = workspace.savedViews.filter((view) => conceptIds.some((id) => view.conceptIds.includes(id)))
  const available = workspace.savedViews.filter((view) => conceptIds.some((id) => !view.conceptIds.includes(id)))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const setMembership = (viewId: string, included: boolean) => store.applyOperations(
    conceptIds.map((conceptId) => ({ kind: 'view.membership', viewId, conceptId, included })),
  )

  return (
    <InspectorSection store={store} id="inspector.views" title={t('views')} onOpenChange={(expanded) => { if (!expanded) setOpen(false) }}>
      {memberships.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] leading-[19px]">
          {memberships.map((view) => (
            <li key={view.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words">{view.name}{conceptIds.length > 1 && <span className="ml-2 text-xs text-muted-foreground">{conceptIds.filter((id) => view.conceptIds.includes(id)).length}/{conceptIds.length}</span>}</span>
              <IconButton disabled={readonly} aria-label={t('removeFromView', { name: view.name })} onClick={() => setMembership(view.id, false)}><X /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <Combobox.Root<SavedView>
        disabled={readonly}
        items={available}
        itemToStringLabel={(view) => view.name}
        value={null}
        open={open}
        onOpenChange={(next) => { setOpen(next); if (next) setQuery('') }}
        inputValue={query}
        onInputValueChange={(next, details) => { if (details.reason !== 'item-press') setQuery(next) }}
        onValueChange={(view) => {
          if (!view) return
          setMembership(view.id, true)
          setOpen(false)
        }}
      >
        <Combobox.Trigger ref={trigger} render={<Button variant="outline" className="mt-3 w-full justify-start bg-transparent" />}><Plus />{t('addToView')}</Combobox.Trigger>
        <ComboboxPopup aria-label={t('addToView')} finalFocus={trigger}>
          {available.length > 0 && <div className="p-1"><Combobox.Input aria-label={t('findView')} placeholder={t('findViewPlaceholder')} render={<Input className="h-8 text-xs" />} /></div>}
          <Combobox.List className="max-h-60 overflow-y-auto">
            {(view) => <ComboboxItem key={view.id} value={view} className="break-words">{view.name}</ComboboxItem>}
          </Combobox.List>
          <Combobox.Empty>
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {workspace.savedViews.length === 0 ? t('noSavedViews') : available.length === 0 ? t('allViewsConcepts', { count: conceptIds.length }) : t('noMatchingViews')}
            </p>
          </Combobox.Empty>
        </ComboboxPopup>
      </Combobox.Root>
    </InspectorSection>
  )
}
