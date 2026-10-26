import type { SavedView } from '@nesso-how/plugin'
import { defaultLocale } from '@nesso-how/i18n'
import { ActionIcon, Button, ContextLabel, Input, Label } from '@nesso-how/ui'
import { Trash2 } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { ConceptColor } from './ConceptColor'
import { DeleteViewDialog } from './DeleteViewDialog'
import { invokeAction, useViewActions } from '@/plugins'
import { maxViewNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

function ViewName({ store, view, readonly }: { store: HostStore; view: SavedView; readonly: boolean }) {
  const t = useTranslation(store)
  const [name, setName] = useState(view.name)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="view-name">{t('name')}</Label>
      <Input id="view-name" readOnly={readonly} value={name} maxLength={maxViewNameLength} onChange={(event) => setName(event.target.value)} onBlur={() => {
        if (readonly) return
        const value = name.trim()
        if (value && value !== view.name) store.renameView(view.id, value)
        setName(value || view.name)
      }} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
      }} />
    </div>
  )
}

export function ViewDetails({ store = nessoStore, readonly = false }: { store?: HostStore; readonly?: boolean }) {
  const t = useTranslation(store)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale, store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const actions = useViewActions()
  const viewGraph = useNessoStore((state) => state.viewGraph, store)
  const view = workspace.savedViews.find((view) => view.id === workspace.activeViewId)
  const stats = [
    { label: t('concepts'), count: viewGraph.concepts.length },
    { label: t('relations'), count: viewGraph.relations.length },
    ...(!view ? [{ label: t('views'), count: workspace.savedViews.length }] : []),
  ]

  return (
    <>
      <ContextLabel>{t(view ? 'activeView' : 'graphOverview')}</ContextLabel>
      {view && <ViewName key={`${view.id}:${view.name}`} store={store} view={view} readonly={readonly} />}
      <ConceptColor key={view?.id ?? 'complete-graph'} store={store} concepts={viewGraph.concepts} readonly={readonly || viewGraph.concepts.length === 0} />
      <section aria-labelledby="view-content-heading">
        <h3 id="view-content-heading" className="text-xs font-medium">{t('content')}</h3>
        <dl className="mt-3 space-y-2">
          {stats.map(({ label, count }) => <div key={label} className="flex items-center justify-between gap-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono">{count}</dd></div>)}
        </dl>
      </section>
      {view && <div className="flex items-center justify-between gap-3">
        <Label id="view-pin-label">{t('pinned')}</Label>
        <Button role="switch" aria-checked={view.pinned} aria-labelledby="view-pin-label" disabled={readonly} variant="ghost" className="h-5 min-h-0 w-8 rounded-sm border-border bg-background p-0.5 aria-checked:border-muted-foreground/60" onClick={() => store.setViewPinned(view.id, !view.pinned)}>
          <span className="size-3 rounded-[2px] bg-muted-foreground transition-transform [[aria-checked=true]_&]:translate-x-1.5 [[aria-checked=true]_&]:bg-foreground [[aria-checked=false]_&]:-translate-x-1.5" />
        </Button>
      </div>}
      <section aria-labelledby="view-actions-heading">
        <h3 id="view-actions-heading" className="text-xs font-medium">{t('actions')}</h3>
        <div className="mt-3 flex flex-col">
          {actions.map((action, index) => (
            <Fragment key={action.id}>
              {index > 0 && <div aria-hidden="true" className="h-px bg-border opacity-60" />}
              <Button disabled={readonly} variant="ghost" className="w-full justify-start text-foreground/80 hover:text-foreground" onClick={() => { void invokeAction(action.id) }}><ActionIcon name={action.icon} />{action.label[locale] ?? action.label.en}</Button>
            </Fragment>
          ))}
        </div>
      </section>
      {view && <Button disabled={readonly} variant="outline" className="w-full justify-start" onClick={() => store.deleteView(view.id)}><Trash2 />{t('deleteView')}</Button>}
      {!view && <>
        <Button ref={deleteTrigger} disabled={readonly} variant="outline" className="w-full justify-start" onClick={() => setConfirmingDelete(true)}><Trash2 />{t('deleteView')}</Button>
        <DeleteViewDialog target={confirmingDelete ? 'complete-graph' : null} onClose={() => setConfirmingDelete(false)} finalFocus={() => deleteTrigger.current} />
      </>}
    </>
  )
}
