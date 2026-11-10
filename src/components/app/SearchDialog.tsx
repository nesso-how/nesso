import { useMemo, useRef, useState, type RefObject } from 'react'
import { Button, Combobox, ComboboxItem, Dialog, DialogPopup, Kbd } from '@nesso-how/ui'
import { CornerDownLeft, Layers, Search } from 'lucide-react'
import { useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'
import { searchGraph, type SearchResult } from '@/graph/search'
import type { HostStore } from '@/store/types'

export function SearchDialog({
  store,
  open,
  onOpenChange,
  onSelect,
  focusRef,
}: {
  store: HostStore
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (result: SearchResult) => void
  focusRef: RefObject<HTMLElement | null>
}) {
  const t = useTranslation(store)
  const graph = useNessoStore((state) => state.graph, store)
  const views = useNessoStore((state) => state.workspace.savedViews, store)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | SearchResult['kind']>('all')
  const input = useRef<HTMLInputElement>(null)
  const navigating = useRef(false)
  const overview = t('completeGraph')
  const results = useMemo(
    () =>
      open
        ? searchGraph(graph, views, query, overview).filter(
            (result) => filter === 'all' || result.kind === filter,
          )
        : [],
    [open, graph, views, query, overview, filter],
  )
  const groups = (['view', 'concept'] as const)
    .map((kind) => ({ kind, items: results.filter((result) => result.kind === kind) }))
    .filter((group) => group.items.length > 0)
  const highlight = (label: string) => {
    const text = query.trim()
    const index = label.toLowerCase().indexOf(text.toLowerCase())
    if (!text || index < 0) return label
    return (
      <>
        {label.slice(0, index)}
        <strong className="font-semibold">{label.slice(index, index + text.length)}</strong>
        {label.slice(index + text.length)}
      </>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Combobox.Root<SearchResult>
        inline
        open={open}
        onOpenChange={onOpenChange}
        items={groups}
        filter={null}
        autoHighlight
        value={null}
        itemToStringLabel={(result) => result.label}
        inputValue={query}
        onInputValueChange={(value, details) => {
          if (details.reason === 'input-change') setQuery(value)
        }}
        onValueChange={(result) => {
          if (!result) return
          navigating.current = true
          onSelect(result)
          onOpenChange(false)
        }}
      >
        <DialogPopup
          className="search-popup flex max-h-[min(580px,calc(100dvh-64px))] w-[min(580px,calc(100vw-32px))] flex-col overflow-hidden p-0"
          initialFocus={() => {
            navigating.current = false
            input.current?.select()
            return input.current
          }}
          finalFocus={() => (navigating.current ? focusRef.current : undefined)}
        >
          <Dialog.Title className="sr-only">{t('searchPlaceholder')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('searchScope')}</Dialog.Description>
          <div className="flex min-h-16 shrink-0 items-center gap-3 border-b px-5">
            <Search className="size-[19px] shrink-0 text-muted-foreground" />
            <Combobox.Input
              ref={input}
              aria-label={t('searchPlaceholder')}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent py-5 text-[15px] outline-none placeholder:text-muted-foreground"
              onKeyDown={(event) => {
                if (
                  !event.nativeEvent.isComposing &&
                  !event.altKey &&
                  (event.metaKey || event.ctrlKey) &&
                  event.key.toLowerCase() === 'k'
                ) {
                  event.preventDefault()
                  event.currentTarget.select()
                }
              }}
            />
            <Dialog.Close
              render={<Button variant="ghost" size="icon-sm" aria-label={t('close')} />}
            >
              <Kbd className="h-5 min-w-0 px-1 text-[9px]">Esc</Kbd>
            </Dialog.Close>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-1.5">
            <div className="flex gap-1" role="group" aria-label={t('search')}>
              {(['all', 'view', 'concept'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="ghost"
                  size="sm"
                  className="px-2.5 text-[11px] aria-pressed:bg-pressed"
                  aria-pressed={filter === kind}
                  onClick={() => {
                    setFilter(kind)
                    input.current?.focus()
                  }}
                >
                  {t(kind === 'all' ? 'searchAll' : kind === 'view' ? 'views' : 'concepts')}
                </Button>
              ))}
            </div>
            <span role="status" className="font-mono text-[10px] text-muted-foreground">
              {query.trim()
                ? t('searchResultCount', { count: results.length })
                : t('searchSuggested')}
            </span>
          </div>
          <Combobox.List
            className="nesso-scroll min-h-0 overflow-y-auto px-2 pb-3"
            aria-label={t('searchResults')}
          >
            {(group: (typeof groups)[number]) => (
              <Combobox.Group key={group.kind} items={group.items}>
                <Combobox.GroupLabel className="px-3 pt-3 pb-1.5 font-mono text-[10px] text-muted-foreground">
                  {t(group.kind === 'view' ? 'views' : 'concepts')}
                </Combobox.GroupLabel>
                <Combobox.Collection>
                  {(result: SearchResult) => (
                    <ComboboxItem
                      key={`${result.kind}:${result.id}`}
                      value={result}
                      className="group flex min-h-11 items-center gap-3 px-3 py-2.5"
                    >
                      <span className="flex w-5 shrink-0 justify-center text-muted-foreground">
                        {result.kind === 'view' ? (
                          <Layers className="size-4" />
                        ) : (
                          <span
                            className="size-3 rounded-[2px] border border-foreground/15"
                            style={{ backgroundColor: result.color ?? 'var(--node-bg)' }}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px]">
                        {highlight(result.label || t('concept'))}
                      </span>
                      {result.kind === 'view' && (
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {t('conceptCount', { count: result.count })}
                        </span>
                      )}
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-data-highlighted:opacity-100" />
                    </ComboboxItem>
                  )}
                </Combobox.Collection>
              </Combobox.Group>
            )}
          </Combobox.List>
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Search className="mb-2 size-6 text-muted-foreground" />
              <p className="max-w-full text-sm wrap-anywhere">
                {t('searchNoResults', { query: query.trim() })}
              </p>
              <p className="text-xs text-muted-foreground">{t('searchTryAgain')}</p>
              <Button
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => {
                  setQuery('')
                  input.current?.focus()
                }}
              >
                {t('searchClear')}
              </Button>
            </div>
          )}
          <footer className="flex shrink-0 items-center gap-4 border-t px-5 py-3 text-[10px] text-muted-foreground [&_kbd]:h-[17px] [&_kbd]:min-w-4 [&_kbd]:px-1 [&_kbd]:text-[10px]">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t('searchNavigate')}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              {t('searchOpen')}
            </span>
          </footer>
        </DialogPopup>
      </Combobox.Root>
    </Dialog.Root>
  )
}
