import { IconButton, ListRow, ListRowButton, ListRowDetail, ListRowTitle } from '@nesso-how/ui'
import { resolveRelationTypeLabel } from '@nesso-how/core'
import type { ConceptMapHandle } from '@nesso-how/concept-map'
import { defaultLocale } from '@nesso-how/i18n'
import { relationKey } from '@nesso-how/schema'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import type { RefObject } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { InspectorSection } from './InspectorSection'
import { useTranslation } from '@/i18n'

export function ConceptConnections({
  store = nessoStore,
  conceptId,
  defaultTypeId,
  readonly = false,
  renderer,
}: {
  store?: HostStore
  conceptId: string
  defaultTypeId: string | undefined
  readonly?: boolean
  renderer?: RefObject<ConceptMapHandle | null>
}) {
  const t = useTranslation(store)
  const graph = useNessoStore((state) => state.graph, store)
  const vocabs = useNessoStore((state) => state.vocabs, store)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale, store)
  const viewGraph = useNessoStore((state) => state.viewGraph, store)
  const activeViewId = useNessoStore((state) => state.workspace.activeViewId, store)
  const visible = new Set(viewGraph.concepts.map((concept) => concept.id))
  const connections = graph.relations
    .filter((relation) => relation.source === conceptId || relation.target === conceptId)
    .map((relation) => {
      const outgoing = relation.source === conceptId
      const otherId = outgoing ? relation.target : relation.source
      const type =
        relation.predicate === defaultTypeId
          ? undefined
          : graph.relationTypes.find((type) => type.id === relation.predicate)
      return {
        relation,
        outgoing,
        otherId,
        label: graph.concepts.find((concept) => concept.id === otherId)?.label ?? '',
        type: type ? resolveRelationTypeLabel(type, vocabs, locale) : '',
        included: visible.has(otherId),
      }
    })
    .sort(
      (a, b) => Number(b.included) - Number(a.included) || a.label.localeCompare(b.label, locale),
    )
  if (connections.length === 0) return null

  const select = (id: string) => {
    store.setSelection([{ kind: 'concept', id }])
    renderer?.current?.focusConcept(id)
  }
  const add = (id: string) => {
    if (activeViewId === null) return
    if (renderer?.current) renderer.current.addToView(id)
    else store.setViewMembership(activeViewId, id, true)
  }
  const row = ({ relation, otherId, label, type, included }: (typeof connections)[number]) => {
    const detail = [type, included ? '' : t('notInView')].filter(Boolean).join(' · ')
    const content = (
      <>
        <ListRowTitle className={included ? undefined : 'text-muted-foreground'}>
          {label}
        </ListRowTitle>
        {detail && <ListRowDetail>{detail}</ListRowDetail>}
      </>
    )
    return (
      <ListRow key={relationKey(relation)} className="min-h-0">
        {included ? (
          <ListRowButton className="py-1.5" onClick={() => select(otherId)}>
            {content}
          </ListRowButton>
        ) : (
          <>
            <div className="min-w-0 flex-1 px-2.5 py-1.5">{content}</div>
            <IconButton
              disabled={readonly}
              className="mr-1"
              title={t('addToCurrentView')}
              aria-label={t('addConceptToCurrentView', { name: label })}
              onClick={() => add(otherId)}
            >
              <Plus />
            </IconButton>
          </>
        )}
      </ListRow>
    )
  }
  const group = (outgoing: boolean) => {
    const items = connections.filter((connection) => connection.outgoing === outgoing)
    if (items.length === 0) return null
    const Direction = outgoing ? ArrowRight : ArrowLeft
    return (
      <div className="mt-2">
        <h3 className="flex items-center gap-1.5 font-mono text-[10px] leading-4 font-normal text-muted-foreground">
          <Direction aria-hidden="true" className="size-3 shrink-0" />
          {t(outgoing ? 'outgoing' : 'incoming')}
          {items.length < connections.length && ` · ${items.length}`}
        </h3>
        <div className="mt-1 flex flex-col gap-0.5">{items.map(row)}</div>
      </div>
    )
  }

  return (
    <InspectorSection
      store={store}
      id="inspector.connections"
      title={t('connections')}
      count={connections.length}
    >
      {group(true)}
      {group(false)}
    </InspectorSection>
  )
}
