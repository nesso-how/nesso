import type { WorkspaceMap } from '@nesso-how/core'
import { Button, ContextLabel, Input, Label } from '@nesso-how/ui'
import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { ConceptColor } from './ConceptColor'
import { DeleteMapDialog } from './DeleteMapDialog'
import { maxMapNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

function MapName({
  store,
  map,
  readonly,
}: {
  store: HostStore
  map: WorkspaceMap
  readonly: boolean
}) {
  const t = useTranslation(store)
  const [name, setName] = useState(map.name)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="map-name">{t('name')}</Label>
      <Input
        id="map-name"
        readOnly={readonly}
        value={name}
        maxLength={maxMapNameLength}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (readonly) return
          const value = name.trim()
          if (value && value !== map.name) store.renameMap(map.id, value)
          setName(value || map.name)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
        }}
      />
    </div>
  )
}

export function MapDetails({
  store = nessoStore,
  readonly = false,
}: {
  store?: HostStore
  readonly?: boolean
}) {
  const t = useTranslation(store)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const workspace = useNessoStore((state) => state.workspace, store)
  const mapGraph = useNessoStore((state) => state.mapGraph, store)
  const map = workspace.maps.find((map) => map.id === workspace.activeMapId)
  const pinned = !!map && workspace.pinnedMapIds.includes(map.id)
  const stats = [
    { label: t('concepts'), count: mapGraph.concepts.length },
    { label: t('relations'), count: mapGraph.relations.length },
    ...(!map ? [{ label: t('maps'), count: workspace.maps.length }] : []),
  ]

  return (
    <>
      <ContextLabel>{t(map ? 'activeMap' : 'completeGraph')}</ContextLabel>
      {map && <MapName key={`${map.id}:${map.name}`} store={store} map={map} readonly={readonly} />}
      {map && (
        <ConceptColor
          key={map.id}
          store={store}
          concepts={mapGraph.concepts}
          readonly={readonly || mapGraph.concepts.length === 0}
        />
      )}
      <section aria-labelledby="map-content-heading">
        <h3 id="map-content-heading" className="text-xs font-medium">
          {t('content')}
        </h3>
        <dl className="mt-3 space-y-2">
          {stats.map(({ label, count }) => (
            <div key={label} className="flex items-center justify-between gap-3 text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono">{count}</dd>
            </div>
          ))}
        </dl>
      </section>
      {map && (
        <div className="flex items-center justify-between gap-3">
          <Label id="map-pin-label">{t('pinned')}</Label>
          <Button
            role="switch"
            aria-checked={pinned}
            aria-labelledby="map-pin-label"
            disabled={readonly}
            variant="ghost"
            className="h-5 min-h-0 w-8 rounded-sm border-border bg-background p-0.5 aria-checked:border-muted-foreground/60"
            onClick={() => store.setMapPinned(map.id, !pinned)}
          >
            <span className="size-3 rounded-[2px] bg-muted-foreground transition-transform [[aria-checked=true]_&]:translate-x-1.5 [[aria-checked=true]_&]:bg-foreground [[aria-checked=false]_&]:-translate-x-1.5" />
          </Button>
        </div>
      )}
      <Button
        ref={deleteTrigger}
        disabled={readonly}
        variant="outline"
        className="w-full justify-start"
        onClick={() => setConfirmingDelete(true)}
      >
        <Trash2 />
        {t('deleteMap')}
      </Button>
      <DeleteMapDialog
        target={confirmingDelete ? (map ?? 'complete-graph') : null}
        onClose={() => setConfirmingDelete(false)}
        finalFocus={() => deleteTrigger.current}
      />
    </>
  )
}
