import { IconButton } from '@nesso/ui'
import { relationKey } from '@nesso/schema'
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react'
import { host, useNessoStore } from '@/store'
import { InspectorSection } from './InspectorSection'
import { useTranslation } from '@/i18n'

export function ConceptConnections({ conceptId, readonly = false }: { conceptId: string; readonly?: boolean }) {
  const t = useTranslation()
  const graph = useNessoStore((state) => state.graph)
  const viewGraph = useNessoStore((state) => state.viewGraph)
  const activeViewId = useNessoStore((state) => state.workspace.activeViewId)
  const visible = new Set(viewGraph.concepts.map((concept) => concept.id))
  const connections = graph.relations.filter((relation) => relation.source === conceptId || relation.target === conceptId)
  if (connections.length === 0) return null

  return (
    <InspectorSection id="inspector.connections" title={t('connections')}>
      <div className="mt-2 space-y-2">
        {connections.map((relation) => {
          const outgoing = relation.source === conceptId
          const Direction = outgoing ? ArrowRight : ArrowLeft
          const otherId = outgoing ? relation.target : relation.source
          const other = graph.concepts.find((concept) => concept.id === otherId)
          const label = graph.relationTypes.find((type) => type.id === relation.predicate)?.label ?? ''
          const included = visible.has(otherId)
          const MembershipIcon = included ? Minus : Plus
          return (
            <div key={relationKey(relation)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-xs">
              <span
                title={t(outgoing ? 'outgoingRelation' : 'incomingRelation')}
                className="col-start-1 inline-flex min-h-6 max-w-full items-center gap-1.5 justify-self-start font-mono text-[10px] leading-[14px] text-muted-foreground"
              >
                <Direction aria-hidden="true" className="size-3 shrink-0" />
                <span className="sr-only">{t(outgoing ? 'outgoingRelation' : 'incomingRelation')}: </span>
                <span className="min-w-0 break-words">{label}</span>
              </span>
              <span className="col-start-1 row-start-2 min-h-6 min-w-0 max-w-full justify-self-start text-[13px] leading-[19px] break-words">{other?.label}</span>
              {activeViewId !== null && !readonly && <IconButton className="col-start-2 row-span-2 row-start-1 self-center" title={t(included ? 'removeFromCurrentView' : 'addToCurrentView')} aria-label={t(included ? 'removeConceptFromCurrentView' : 'addConceptToCurrentView', { name: other?.label ?? '' })} onClick={() => host.store.setViewMembership(activeViewId, otherId, !included)}><MembershipIcon /></IconButton>}
            </div>
          )
        })}
      </div>
    </InspectorSection>
  )
}
