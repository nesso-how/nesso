import { Button, Combobox, ComboboxItem, ComboboxPopup, Input } from '@nesso/ui'
import { Plus, X } from 'lucide-react'
import type { SavedView } from '@nesso/plugin'
import { useRef, useState } from 'react'
import { host, useNessoStore } from '@/store'
import { InspectorSection } from './InspectorSection'

export function ConceptViews({ conceptIds }: { conceptIds: readonly string[] }) {
  const workspace = useNessoStore((state) => state.workspace)
  const memberships = workspace.savedViews.filter((view) => conceptIds.some((id) => view.conceptIds.includes(id)))
  const available = workspace.savedViews.filter((view) => conceptIds.some((id) => !view.conceptIds.includes(id)))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const setMembership = (viewId: string, included: boolean) => host.store.applyOperations(
    conceptIds.map((conceptId) => ({ kind: 'view.membership', viewId, conceptId, included })),
  )

  return (
    <InspectorSection id="inspector.views" title="Views" onOpenChange={(expanded) => { if (!expanded) setOpen(false) }}>
      {memberships.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] leading-[19px]">
          {memberships.map((view) => (
            <li key={view.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words">{view.name}{conceptIds.length > 1 && <span className="ml-2 text-xs text-muted-foreground">{conceptIds.filter((id) => view.conceptIds.includes(id)).length}/{conceptIds.length}</span>}</span>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label={`Remove from ${view.name}`} onClick={() => setMembership(view.id, false)}><X /></Button>
            </li>
          ))}
        </ul>
      )}
      <Combobox.Root<SavedView>
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
        <Combobox.Trigger ref={trigger} render={<Button variant="outline" className="mt-3 w-full justify-start bg-transparent" />}><Plus />Add to view</Combobox.Trigger>
        <ComboboxPopup aria-label="Add to view" finalFocus={trigger}>
          {available.length > 0 && <div className="p-1"><Combobox.Input aria-label="Find a view" placeholder="Find a view…" render={<Input className="h-8 text-xs" />} /></div>}
          <Combobox.List className="max-h-60 overflow-y-auto">
            {(view) => <ComboboxItem key={view.id} value={view} className="break-words">{view.name}</ComboboxItem>}
          </Combobox.List>
          <Combobox.Empty>
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {workspace.savedViews.length === 0 ? 'No saved views yet. Create one in the Explorer.' : available.length === 0 ? `${conceptIds.length === 1 ? 'This concept is' : 'These concepts are'} in all saved views.` : 'No matching views.'}
            </p>
          </Combobox.Empty>
        </ComboboxPopup>
      </Combobox.Root>
    </InspectorSection>
  )
}
