import type { WorkspaceMap } from '@nesso-how/core'
import { IconButton } from '@nesso-how/ui'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useMemo } from 'react'
import { useNessoStore } from '@/store'
import type { HostOperation, HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { mapSections } from './map-sections'

function VisibilityRow({
  store,
  name,
  visible,
  locked = false,
  operation,
  toggle,
  inset = false,
  group = false,
}: {
  store: HostStore
  name: string
  visible: boolean
  locked?: boolean
  operation: (visible: boolean) => HostOperation
  toggle?: { open: boolean; controls: string; onToggle: () => void }
  inset?: boolean
  group?: boolean
}) {
  const t = useTranslation(store)
  const shown = visible && !locked
  return (
    <div
      className="group/row flex items-center justify-between gap-3 text-xs data-group:font-mono data-group:text-muted-foreground"
      data-hidden={shown ? undefined : ''}
      data-group={group || undefined}
    >
      {toggle ? (
        <button
          type="button"
          className="flex min-w-0 items-center gap-1 text-left hover:text-foreground"
          aria-expanded={toggle.open}
          aria-controls={toggle.controls}
          onClick={toggle.onToggle}
        >
          <ChevronDown className={`size-3 shrink-0 ${toggle.open ? '' : '-rotate-90'}`} />
          <span className="min-w-0 break-words group-data-hidden/row:opacity-60">{name}</span>
        </button>
      ) : (
        <span
          className="min-w-0 break-words group-data-hidden/row:opacity-60 data-inset:pl-4"
          data-inset={inset || undefined}
        >
          {name}
        </span>
      )}
      <IconButton
        aria-label={t(shown ? 'hideFromGraph' : 'showInGraph', { name })}
        disabled={locked}
        onClick={() => store.applyOperations([operation(!visible)])}
      >
        {shown ? <Eye /> : <EyeOff />}
      </IconButton>
    </div>
  )
}

export function MapVisibility({ store }: { store: HostStore }) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const hidden = useNessoStore((state) => state.hiddenMapGroupIds, store)
  const hiddenMaps = useNessoStore((state) => state.hiddenMapIds, store)
  const concepts = useNessoStore((state) => state.graph.concepts, store)
  const unmapped = useMemo(() => {
    if (hiddenMaps.includes(null)) return true
    const mapped = new Set(workspace.maps.flatMap(({ members }) => members.map(({ id }) => id)))
    return concepts.some(({ id }) => !mapped.has(id))
  }, [concepts, workspace.maps, hiddenMaps])
  const sections = mapSections(workspace, workspace.maps)
  const groups: { id: string | null; name: string; maps: readonly WorkspaceMap[] }[] = [
    ...sections.groups,
    ...(hidden.includes(null) || sections.ungrouped.length
      ? [{ id: null, name: t('ungroupedMaps'), maps: sections.ungrouped }]
      : []),
  ]

  if (!groups.length && !unmapped) return null
  return (
    <section aria-labelledby="map-visibility-heading">
      <h3 id="map-visibility-heading" className="text-xs font-medium">
        {t('visibility')}
      </h3>
      <ul className="mt-2 space-y-0.5">
        {groups.map((group, index) => {
          const visible = !hidden.includes(group.id)
          const { id } = group
          const open = id === null || !workspace.collapsedMapGroupIds?.includes(id)
          const controls = `map-visibility-group-${index}`
          return (
            <li key={id ?? ''}>
              <VisibilityRow
                store={store}
                name={group.name}
                visible={visible}
                operation={(visible) => ({ kind: 'map-group.setVisible', id, visible })}
                group
                inset={id === null}
                toggle={
                  id === null
                    ? undefined
                    : {
                        open,
                        controls,
                        onToggle: () =>
                          store.applyOperations([{ kind: 'map-group.setOpen', id, open: !open }]),
                      }
                }
              />
              {(id !== null || group.maps.length > 0) && (
                <ul id={controls} hidden={!open} className="space-y-0.5 pl-4">
                  {!group.maps.length && (
                    <li className="text-xs text-muted-foreground">{t('noMapsInGroup')}</li>
                  )}
                  {group.maps.map((item) => (
                    <li key={item.id}>
                      <VisibilityRow
                        store={store}
                        name={item.name}
                        visible={!hiddenMaps.includes(item.id)}
                        locked={!visible}
                        operation={(visible) => ({
                          kind: 'map.setVisible',
                          id: item.id,
                          visible,
                        })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
        {unmapped && (
          <li>
            <VisibilityRow
              store={store}
              name={t('unmappedConcepts')}
              inset
              visible={!hiddenMaps.includes(null)}
              operation={(visible) => ({ kind: 'map.setVisible', id: null, visible })}
            />
          </li>
        )}
      </ul>
    </section>
  )
}
