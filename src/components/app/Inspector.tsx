import { newIri, relationKey, type RelationType } from '@nesso-how/schema'
import { resolveRelationTypeLabel } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import { maxConceptLabelLength, maxRelationLabelLength } from '@/store/settings'
import { useMemo, useRef, useState, type RefObject } from 'react'
import type { ConceptMapHandle } from '@nesso-how/concept-map'
import {
  Autocomplete,
  AutocompleteClear,
  AutocompleteItem,
  AutocompletePopup,
  Button,
  ContextLabel,
  Input,
  Label,
  MarkdownInput,
} from '@nesso-how/ui'
import { ArrowUpDown, Trash2 } from 'lucide-react'
import { ViewDetails } from './ViewDetails'
import { ConceptViews } from './ConceptViews'
import { ConceptConnections } from './ConceptConnections'
import { ConceptColor } from './ConceptColor'
import { InspectorSection } from './InspectorSection'
import { DeleteConceptsDialog } from './DeleteConceptsDialog'
import { nessoStore, useNessoStore } from '@/store'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { openNotesLink } from './notes-link'
import { relationSelection, relationTypeOperations } from '@/graph/relation-selection'
import { deleteOperations, deletionNeedsConfirmation } from '@/graph/commands'

function RelationInput({
  typeId,
  label,
  defaultTypeId,
  relationTypes,
  taken,
  onSave,
  onCreate,
  readonly,
  autoFocus,
}: {
  typeId: string
  label: string
  defaultTypeId: string | undefined
  relationTypes: readonly Readonly<RelationType>[]
  taken: ReadonlySet<string>
  onSave: (typeId: string) => void
  onCreate: (label: string) => void
  readonly: boolean
  autoFocus?: boolean
}) {
  const t = useTranslation()
  const [value, setValue] = useState(label)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const highlighted = useRef<Readonly<RelationType> | undefined>(undefined)
  const query = value.trim().toLowerCase()
  const visible = relationTypes.filter(
    (item) => item.id !== typeId && !taken.has(item.id) && item.label.toLowerCase().includes(query),
  )
  const choose = (id: string, next: string) => {
    if (taken.has(id)) {
      setValue(label)
      return
    }
    onSave(id)
    setValue(next)
  }

  const save = (raw: string) => {
    if (readonly) return
    const trimmed = raw.trim()
    if (trimmed.toLowerCase() === label.trim().toLowerCase()) return
    if (!trimmed) {
      if (defaultTypeId) choose(defaultTypeId, '')
      return
    }
    const matches = relationTypes.filter(
      (item) => item.label.toLowerCase() === trimmed.toLowerCase(),
    )
    if (matches.length > 1) {
      setError(true)
      setOpen(true)
      return
    }
    if (matches.length === 1) {
      choose(matches[0].id, matches[0].label)
      return
    }
    onCreate(trimmed)
    setValue(trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="relation-label">{t('relation')}</Label>
      <Autocomplete.Root
        items={relationTypes}
        filteredItems={visible}
        itemToStringValue={(item) => item.label}
        value={value}
        open={!readonly && open && visible.length > 0}
        onOpenChange={setOpen}
        onValueChange={(next, details) => {
          if (readonly) return
          setValue(next)
          setError(false)
          if (details.reason === 'clear-press' && defaultTypeId) choose(defaultTypeId, '')
        }}
        onItemHighlighted={(item) => {
          highlighted.current = item
        }}
        openOnInputClick={!readonly}
      >
        <div className="relative">
          <Autocomplete.Input
            id="relation-label"
            autoFocus={autoFocus}
            readOnly={readonly}
            maxLength={maxRelationLabelLength}
            aria-invalid={Boolean(error)}
            render={<Input className="pr-7" />}
            onBlur={(event) => save(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !highlighted.current) save(event.currentTarget.value)
            }}
            placeholder={t('relationPlaceholder')}
          />
          <AutocompleteClear disabled={readonly} aria-label={t('clearRelation')} />
        </div>
        <AutocompletePopup>
          <Autocomplete.List>
            {(item: Readonly<RelationType>) => (
              <AutocompleteItem
                key={item.id}
                value={item}
                onClick={() => choose(item.id, item.label)}
              >
                {item.label}
                {relationTypes.some(
                  (type) =>
                    type.id !== item.id && type.label.toLowerCase() === item.label.toLowerCase(),
                ) && <span className="ml-2 text-xs text-muted-foreground">{item.id}</span>}
              </AutocompleteItem>
            )}
          </Autocomplete.List>
        </AutocompletePopup>
      </Autocomplete.Root>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t('ambiguousRelation')}
        </p>
      )}
    </div>
  )
}

export function Inspector({
  store = nessoStore,
  readonly = false,
  relationTypeOnly = false,
  focusRelation = false,
  renderer,
}: {
  store?: HostStore
  readonly?: boolean
  relationTypeOnly?: boolean
  focusRelation?: boolean
  renderer?: RefObject<ConceptMapHandle | null>
}) {
  const t = useTranslation(store)
  const textGroup = useRef<string | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const graph = useNessoStore((state) => state.graph, store)
  const selected = useNessoStore((state) => state.selected, store)
  const viewGraph = useNessoStore((state) => state.viewGraph, store)
  const vocabs = useNessoStore((state) => state.vocabs, store)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale, store)
  const activeVocabId = useNessoStore((state) => state.preferences.activeVocabId, store)
  const activeVocab = vocabs.find((vocab) => vocab.id === activeVocabId)
  const offered = new Map<string, Readonly<RelationType>>()
  for (const type of [...graph.relationTypes, ...(activeVocab?.relationTypes ?? [])]) {
    if (type.id !== activeVocab?.defaultTypeId && !offered.has(type.id)) offered.set(type.id, type)
  }
  const relationTypes = [...offered.values()].map((type) => ({
    id: type.id,
    label: resolveRelationTypeLabel(type, vocabs, locale),
  }))
  const item = selected.length === 1 ? selected[0] : undefined
  const conceptIds = selected.filter((item) => item.kind === 'concept').map((item) => item.id)
  const relationCount = selected.length - conceptIds.length
  const visibleIds = useMemo(
    () => new Set(viewGraph.concepts.map((concept) => concept.id)),
    [viewGraph.concepts],
  )
  const outsideCount = conceptIds.filter((id) => !visibleIds.has(id)).length
  const styled = viewGraph.concepts.filter(
    (concept) => concept.position && conceptIds.includes(concept.id),
  )
  const concept =
    item?.kind === 'concept' ? graph.concepts.find((concept) => concept.id === item.id) : undefined
  const selectedEdges = relationSelection(graph, selected)
  const selectedEdge = selectedEdges[0]
  const labels = (ids: readonly string[]) =>
    [...new Set(ids)]
      .map((id) => graph.concepts.find((concept) => concept.id === id)?.label ?? '?')
      .join(', ')
  const sourceLabel = labels(selectedEdges.map(({ source }) => source))
  const targetLabel = labels(selectedEdges.map(({ target }) => target))
  const selectedRelationId = selectedEdge?.predicate
  const selectedRelationLabel =
    selectedRelationId === activeVocab?.defaultTypeId
      ? ''
      : (relationTypes.find((item) => item.id === selectedRelationId)?.label ?? '')
  const parallelTypes = new Set(
    selectedEdge
      ? graph.relations
          .filter(
            (relation) =>
              !selectedEdges.includes(relation) &&
              selectedEdges.some(
                (edge) => relation.source === edge.source && relation.target === edge.target,
              ),
          )
          .map((relation) => relation.predicate)
      : [],
  )
  const invertedExists = selectedEdge
    ? graph.relations.some((relation) =>
        selectedEdges.some(
          (edge) =>
            relation.source === edge.target &&
            relation.target === edge.source &&
            relation.predicate === edge.predicate,
        ),
      )
    : false

  return (
    <aside
      id="details-panel"
      aria-label={t('details')}
      className="nesso-scroll flex h-full flex-col gap-[26px] overflow-y-auto bg-background px-5 py-6 text-sm"
    >
      {selected.length > 0 && (
        <ContextLabel>{t(selectedEdge ? 'relation' : item ? item.kind : 'selection')}</ContextLabel>
      )}
      {selected.length === 0 ? (
        <ViewDetails store={store} readonly={readonly} />
      ) : selected.length > 1 && !selectedEdge ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            {[
              conceptIds.length > 0 ? t('conceptCount', { count: conceptIds.length }) : '',
              relationCount > 0 ? t('relationCount', { count: relationCount }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground">{t('singleSelectionHint')}</p>
          {outsideCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('outsideConceptCount', { count: outsideCount })}
            </p>
          )}
        </div>
      ) : concept ? (
        <section className="flex flex-col gap-[26px]">
          {outsideCount > 0 && (
            <p className="text-xs text-muted-foreground">{t('outsideConcept')}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>{t('label')}</Label>
            <Input
              key={concept.id}
              id="concept-label"
              maxLength={maxConceptLabelLength}
              data-document-edit
              value={concept.label}
              readOnly={readonly}
              onFocus={() => {
                textGroup.current = newIri()
              }}
              onBlur={() => {
                textGroup.current = undefined
              }}
              onChange={(event) => {
                if (!readonly)
                  store.setConceptLabel(
                    concept.id,
                    event.target.value,
                    (textGroup.current ??= newIri()),
                  )
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concept-notes">{t('notes')}</Label>
            <MarkdownInput
              key={concept.id}
              id="concept-notes"
              className="max-h-[50vh]"
              aria-label={t('notes')}
              placeholder={t('notesPlaceholder')}
              data-document-edit
              value={concept.notes ?? ''}
              readOnly={readonly}
              history={false}
              onFocus={() => {
                textGroup.current = newIri()
              }}
              onBlur={() => {
                textGroup.current = undefined
              }}
              onOpenLink={(url) => openNotesLink(url, t('notesLinkOpenFailed'))}
              onChange={(value) => {
                if (!readonly)
                  store.setConceptNotes(concept.id, value, (textGroup.current ??= newIri()))
              }}
            />
          </div>
        </section>
      ) : selectedEdge ? (
        <section className="flex flex-col gap-[26px]">
          <RelationInput
            key={`${selectedEdges.map(relationKey).join('|')}:${selectedRelationLabel}`}
            typeId={selectedEdge.predicate}
            label={selectedRelationLabel}
            defaultTypeId={activeVocab?.defaultTypeId}
            relationTypes={relationTypes}
            taken={parallelTypes}
            onSave={(typeId) =>
              store.applyOperations(relationTypeOperations(selectedEdges, { id: typeId }))
            }
            onCreate={(label) =>
              store.applyOperations(relationTypeOperations(selectedEdges, { label }))
            }
            readonly={readonly}
            autoFocus={focusRelation}
          />
          <InspectorSection store={store} id="inspector.nodes" title={t('nodes')}>
            <div className="mt-2 space-y-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] leading-[14px] text-muted-foreground">
                  {t('from')}
                </span>
                <span className="text-[13px] leading-[19px] break-words">{sourceLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] leading-[14px] text-muted-foreground">
                  {t('to')}
                </span>
                <span className="text-[13px] leading-[19px] break-words">{targetLabel}</span>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={readonly || relationTypeOnly || invertedExists}
                onClick={() => {
                  store.applyOperations(
                    selectedEdges.map((edge) => ({
                      kind: 'relation.reconnect',
                      id: relationKey(edge),
                      source: edge.target,
                      target: edge.source,
                    })),
                  )
                }}
              >
                <ArrowUpDown />
                {t('invertRelation')}
              </Button>
            </div>
          </InspectorSection>
        </section>
      ) : null}
      {conceptIds.length > 0 && styled.length === conceptIds.length && (
        <ConceptColor
          key={`color:${JSON.stringify(conceptIds)}`}
          store={store}
          concepts={styled}
          readonly={readonly}
        />
      )}
      {concept && (
        <ConceptConnections
          key={`connections:${concept.id}`}
          store={store}
          conceptId={concept.id}
          defaultTypeId={activeVocab?.defaultTypeId}
          readonly={readonly}
          renderer={renderer}
        />
      )}
      {conceptIds.length > 0 && (
        <ConceptViews
          key={JSON.stringify(conceptIds)}
          store={store}
          conceptIds={conceptIds}
          readonly={readonly}
        />
      )}
      {concept && (
        <Button
          variant="outline"
          className="w-full justify-start"
          disabled={readonly || graph.concepts.length <= 1}
          onClick={() => {
            const state = store.getState()
            if (deletionNeedsConfirmation(state)) setConfirming(true)
            else store.applyOperations(deleteOperations(state))
          }}
        >
          <Trash2 />
          {t('deleteConcept')}
        </Button>
      )}
      <DeleteConceptsDialog store={store} open={confirming} onClose={() => setConfirming(false)} />
      {selectedEdge && (
        <Button
          disabled={readonly || relationTypeOnly}
          variant="outline"
          className="w-full justify-start"
          onClick={() =>
            store.applyOperations(
              selectedEdges.map((edge) => ({ kind: 'relation.remove', id: relationKey(edge) })),
            )
          }
        >
          <Trash2 />
          {t('deleteRelation')}
        </Button>
      )}
    </aside>
  )
}
