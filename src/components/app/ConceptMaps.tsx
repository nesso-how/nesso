import {
  Button,
  Combobox,
  ComboboxItem,
  ComboboxPopup,
  IconButton,
  Input,
  ListRow,
  ListRowButton,
  ListRowDetail,
  ListRowTitle,
} from '@nesso-how/ui'
import { Plus } from 'lucide-react'
import type { WorkspaceMap } from '@nesso-how/core'
import { useRef, useState } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { maxMapNameLength } from '@/store/settings'
import { InspectorSection } from './InspectorSection'
import { useTranslation } from '@/i18n'

type Option = { readonly id: string; readonly name: string; readonly create?: true }

export function ConceptMaps({
  store = nessoStore,
  conceptIds,
  readonly = false,
}: {
  store?: HostStore
  conceptIds: readonly string[]
  readonly?: boolean
}) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const coverage = (map: WorkspaceMap) =>
    conceptIds.filter((id) => map.members.some((member) => member.id === id)).length
  const listed = workspace.maps.filter((map) => coverage(map) > 0)
  const others = workspace.maps.filter((map) => coverage(map) === 0)
  const name = query.trim()
  const options: readonly Option[] =
    name && !workspace.maps.some((map) => map.name === name)
      ? [...others, { id: '', name, create: true }]
      : others
  const addTo = (mapId: string) =>
    store.applyOperations([
      ...conceptIds.map((conceptId) => ({
        kind: 'map.membership' as const,
        mapId,
        conceptId,
        included: true,
      })),
      { kind: 'map.activate', id: mapId },
    ])

  return (
    <InspectorSection
      store={store}
      id="inspector.maps"
      title={t('maps')}
      onOpenChange={(expanded) => {
        if (!expanded) setOpen(false)
      }}
    >
      {listed.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {listed.map((map) => {
            const count = coverage(map)
            return (
              <ListRow key={map.id} className="min-h-0 has-[[aria-current]]:bg-accent">
                <ListRowButton
                  className="py-1.5"
                  onClick={() => store.setMap(map.id)}
                  aria-current={map.id === workspace.activeMapId ? 'page' : undefined}
                >
                  <ListRowTitle>{map.name}</ListRowTitle>
                  {conceptIds.length > 1 && (
                    <ListRowDetail>
                      {count}/{conceptIds.length}
                    </ListRowDetail>
                  )}
                </ListRowButton>
                {count < conceptIds.length && (
                  <IconButton
                    disabled={readonly}
                    className="mr-1"
                    aria-label={t('addSelectionToMap', { name: map.name })}
                    onClick={() => addTo(map.id)}
                  >
                    <Plus />
                  </IconButton>
                )}
              </ListRow>
            )
          })}
        </div>
      )}
      <Combobox.Root<Option>
        disabled={readonly}
        items={options}
        itemToStringLabel={(option) => option.name}
        value={null}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setQuery('')
        }}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.reason !== 'item-press') setQuery(next)
        }}
        onValueChange={(option) => {
          if (!option) return
          if (option.create) store.createMap(option.name, conceptIds)
          else addTo(option.id)
          setOpen(false)
        }}
      >
        <Combobox.Trigger
          ref={trigger}
          aria-label={t('otherMaps')}
          render={<Button variant="outline" className="mt-2 w-full justify-start bg-transparent" />}
        >
          <Plus />
          {t('otherMaps')}
          {others.length > 0 && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {others.length}
            </span>
          )}
        </Combobox.Trigger>
        <ComboboxPopup aria-label={t('otherMaps')} finalFocus={trigger}>
          <div className="p-1">
            <Combobox.Input
              aria-label={t('findMap')}
              placeholder={t('findOrCreateMap')}
              maxLength={maxMapNameLength}
              render={<Input className="h-8 text-xs" />}
            />
          </div>
          <Combobox.List className="nesso-scroll max-h-60 overflow-y-auto">
            {(option: Option) => (
              <ComboboxItem
                key={option.id || 'create'}
                value={option}
                className={`break-words ${option.create ? 'flex items-center gap-2 [&_svg]:size-3.5' : ''}`}
              >
                {option.create ? (
                  <>
                    <Plus />
                    {t('newMapNamed', { name: option.name })}
                  </>
                ) : (
                  option.name
                )}
              </ComboboxItem>
            )}
          </Combobox.List>
          <Combobox.Empty>
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {t(name ? 'noMatchingMaps' : 'createMapHint')}
            </p>
          </Combobox.Empty>
        </ComboboxPopup>
      </Combobox.Root>
    </InspectorSection>
  )
}
