import { useEffect, useMemo, useRef, useState } from 'react'
import { useNodesInitialized } from '@xyflow/react'
import { Combobox, ComboboxItem, ComboboxPopup } from '@nesso-how/ui'
import type { ConceptData } from './types'
import { useCanvasContext, useNesso } from './store'
import { creationSuggestions } from './creation'
import { useTranslation } from './i18n'

export function ConceptLabelEditor({
  id,
  data,
  onFinish,
}: {
  id: string
  data: ConceptData
  onFinish: (focus: boolean) => void
}) {
  const t = useTranslation()
  const { store } = useCanvasContext()
  const graph = useNesso((state) => state.graph)
  const viewGraph = useNesso((state) => state.viewGraph)
  const input = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  const highlighted = useRef<string | undefined>(undefined)
  const [query, setQuery] = useState<string>()
  const [open, setOpen] = useState(false)
  const initialized = useNodesInitialized()
  useEffect(() => {
    if (!initialized) return
    input.current?.focus({ preventScroll: true })
    input.current?.select()
  }, [initialized])
  const suggestions = useMemo(
    () =>
      data.onReuse && query !== undefined ? creationSuggestions({ graph, viewGraph }, query) : [],
    [data.onReuse, graph, viewGraph, query],
  )
  const commit = (focus: boolean) => {
    if (finished.current) return
    finished.current = true
    if (query !== undefined && query !== data.label) {
      try {
        store.applyOperations([{ kind: 'concept.label', id, value: query }], {
          historyGroup: data.historyGroup,
        })
      } catch {}
    }
    onFinish(focus)
  }

  return (
    <Combobox.Root<(typeof suggestions)[number]>
      items={suggestions}
      filter={null}
      value={null}
      itemToStringLabel={(concept) => concept.label}
      inputValue={query ?? data.label}
      onInputValueChange={(value, details) => {
        if (details.reason !== 'input-change') return
        setQuery(value)
        setOpen(true)
      }}
      open={open && suggestions.length > 0}
      onOpenChange={setOpen}
      onItemHighlighted={(concept) => {
        highlighted.current = concept?.id
      }}
      onValueChange={(concept) => {
        if (!concept || finished.current || !data.onReuse) return
        finished.current = true
        data.onReuse(concept.id)
      }}
    >
      <Combobox.Input
        ref={input}
        maxLength={data.maxLength}
        aria-label={t('editConceptLabel')}
        data-document-edit
        onBlur={() => commit(false)}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape') {
            event.preventDefault()
            event.preventBaseUIHandler()
            finished.current = true
            onFinish(true)
          } else if (event.key === 'Enter' && (!open || !highlighted.current)) {
            event.preventDefault()
            event.preventBaseUIHandler()
            commit(true)
          }
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className="nodrag"
      />
      <ComboboxPopup
        aria-label={t('reuseConcept')}
        className="nodrag nopan nowheel min-w-56 max-w-80 text-sm font-normal not-italic"
        finalFocus={false}
      >
        <p className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] text-muted-foreground">
          {t('reuseConcept')}
        </p>
        <Combobox.List>
          {(concept: (typeof suggestions)[number]) => (
            <ComboboxItem key={concept.id} value={concept} className="truncate">
              {concept.label}
            </ComboboxItem>
          )}
        </Combobox.List>
      </ComboboxPopup>
    </Combobox.Root>
  )
}
