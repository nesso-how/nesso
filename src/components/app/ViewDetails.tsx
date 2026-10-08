import type { SavedView } from '@nesso/plugin'
import { defaultLocale } from '@nesso/i18n'
import { Button, ContextLabel, Input, Label } from '@nesso/ui'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { host, useNessoStore } from '@/store'
import { viewActions } from '@/plugins'
import { useToasts, viewExportedToast } from './toastQueue'
import { maxViewNameLength } from '@/store/settings'
import { useTranslation } from '@/i18n'

function ViewName({ view }: { view: SavedView }) {
  const t = useTranslation()
  const [name, setName] = useState(view.name)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="view-name">{t('name')}</Label>
      <Input id="view-name" value={name} maxLength={maxViewNameLength} onChange={(event) => setName(event.target.value)} onBlur={() => {
        const value = name.trim()
        if (value && value !== view.name) host.store.renameView(view.id, value)
        setName(value || view.name)
      }} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
      }} />
    </div>
  )
}

export function ViewDetails({ readonly = false }: { readonly?: boolean }) {
  const t = useTranslation()
  const { notify } = useToasts()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const workspace = useNessoStore((state) => state.workspace)
  const viewGraph = useNessoStore((state) => state.viewGraph)
  const view = workspace.savedViews.find((view) => view.id === workspace.activeViewId)
  const stats = [
    { label: t('concepts'), count: viewGraph.concepts.length },
    { label: t('relations'), count: viewGraph.relations.length },
    ...(!view ? [{ label: t('views'), count: workspace.savedViews.length }] : []),
  ]

  return (
    <>
      <ContextLabel>{t(view ? 'activeView' : 'graphOverview')}</ContextLabel>
      {view && !readonly ? <ViewName key={`${view.id}:${view.name}`} view={view} /> : view ? <h3 className="font-medium break-words">{view.name}</h3> : null}
      <section aria-labelledby="view-content-heading">
        <h3 id="view-content-heading" className="text-xs font-medium">{t('content')}</h3>
        <dl className="mt-3 space-y-2">
          {stats.map(({ label, count }) => <div key={label} className="flex items-center justify-between gap-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono">{count}</dd></div>)}
        </dl>
      </section>
      {view && <div className="flex items-center justify-between gap-3">
        <Label id="view-pin-label">{t('pinned')}</Label>
        <Button role="switch" aria-checked={view.pinned} aria-labelledby="view-pin-label" disabled={readonly} variant="ghost" className="h-5 min-h-0 w-8 rounded-sm border-border bg-background p-0.5 aria-checked:border-muted-foreground/60" onClick={() => host.store.setViewPinned(view.id, !view.pinned)}>
          <span className="size-3 rounded-[2px] bg-muted-foreground transition-transform [[aria-checked=true]_&]:translate-x-1.5 [[aria-checked=true]_&]:bg-foreground [[aria-checked=false]_&]:-translate-x-1.5" />
        </Button>
      </div>}
      <section aria-labelledby="view-actions-heading">
        <h3 id="view-actions-heading" className="text-xs font-medium">{t('actions')}</h3>
        <div className="mt-3 flex flex-col gap-2">
          {viewActions.map((action) => <Button key={action.id} variant="outline" className="w-full justify-start" onClick={() => {
            action.runOnView?.(workspace.activeViewId)
            if (action.id === 'export-view') notify(viewExportedToast(t))
          }}>{action.label(locale)}</Button>)}
        </div>
      </section>
      {view && !readonly && <Button variant="outline" className="w-full justify-start" onClick={() => host.store.deleteView(view.id)}><Trash2 />{t('deleteView')}</Button>}
    </>
  )
}
