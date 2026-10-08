import { newIri, relationKey, type RelationType } from '@nesso/schema'
import { maxConceptLabelLength, maxRelationLabelLength } from '@/store/settings'
import { useRef, useState } from 'react'
import { Autocomplete, AutocompleteClear, AutocompleteItem, AutocompletePopup, Input, Label } from '@nesso/ui'
import { ConceptViews } from './ConceptViews'
import { ConceptConnections } from './ConceptConnections'
import { InspectorSection } from './InspectorSection'
import { nessoStore, useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'

function RelationInput({ edgeId, typeId, label, defaultTypeId, relationTypes, onSave, onCreate }: {
  edgeId: string
  typeId: string
  label: string
  defaultTypeId: string | undefined
  relationTypes: readonly Readonly<RelationType>[]
  onSave: (id: string, typeId: string) => void
  onCreate: (id: string, label: string) => void
}) {
  const t = useTranslation()
  const [value, setValue] = useState(label)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const highlighted = useRef<Readonly<RelationType> | undefined>(undefined)
  const query = value.trim().toLowerCase()
  const visible = relationTypes.filter((item) =>
    item.id !== typeId && item.label.toLowerCase().includes(query))

  const save = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed.toLowerCase() === label.trim().toLowerCase()) return
    if (!trimmed) {
      if (defaultTypeId) onSave(edgeId, defaultTypeId)
      return
    }
    const matches = relationTypes.filter((item) => item.label.toLowerCase() === trimmed.toLowerCase())
    if (matches.length > 1) {
      setError(true)
      setOpen(true)
      return
    }
    if (matches.length === 1) onSave(edgeId, matches[0].id)
    else onCreate(edgeId, trimmed)
    setValue(matches[0]?.label ?? trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="relation-label">{t('relation')}</Label>
      <Autocomplete.Root
        items={relationTypes}
        filteredItems={visible}
        itemToStringValue={(item) => item.label}
        value={value}
        open={open && visible.length > 0}
        onOpenChange={setOpen}
        onValueChange={(next, details) => {
          setValue(next)
          setError(false)
          if (details.reason === 'clear-press' && defaultTypeId) onSave(edgeId, defaultTypeId)
        }}
        onItemHighlighted={(item) => { highlighted.current = item }}
        openOnInputClick
      >
        <div className="relative">
          <Autocomplete.Input
            id="relation-label"
            maxLength={maxRelationLabelLength}
            aria-invalid={Boolean(error)}
            render={<Input className="pr-7" />}
            onBlur={(event) => save(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !highlighted.current) save(event.currentTarget.value)
            }}
            placeholder={t('relationPlaceholder')}
          />
          <AutocompleteClear aria-label={t('clearRelation')} />
        </div>
        <AutocompletePopup>
          <Autocomplete.List>
            {(item: Readonly<RelationType>) => (
              <AutocompleteItem key={item.id} value={item} onClick={() => onSave(edgeId, item.id)}>
                {item.label}
                {relationTypes.some((type) => type.id !== item.id && type.label.toLowerCase() === item.label.toLowerCase()) && (
                  <span className="ml-2 text-xs text-muted-foreground">{item.id}</span>
                )}
              </AutocompleteItem>
            )}
          </Autocomplete.List>
        </AutocompletePopup>
      </Autocomplete.Root>
      {error && <p role="alert" className="text-xs text-destructive">{t('ambiguousRelation')}</p>}
    </div>
  )
}

export function Inspector({ readonly = false }: { readonly?: boolean }) {
  const t = useTranslation()
  const textGroup = useRef<string | undefined>(undefined)
  const graph = useNessoStore((state) => state.graph)
  const selected = useNessoStore((state) => state.selected)
  const viewGraph = useNessoStore((state) => state.viewGraph)
  const vocabs = useNessoStore((state) => state.vocabs)
  const activeVocabId = useNessoStore((state) => state.preferences.activeVocabId)
  const activeVocab = vocabs.find((vocab) => vocab.id === activeVocabId)
  const offered = new Map<string, Readonly<RelationType>>()
  for (const type of [...graph.relationTypes, ...(activeVocab?.relationTypes ?? [])]) {
    if (type.id !== activeVocab?.defaultTypeId && !offered.has(type.id)) offered.set(type.id, type)
  }
  const relationTypes = [...offered.values()]
  const item = selected.length === 1 ? selected[0] : undefined
  const conceptIds = selected.filter((item) => item.kind === 'concept').map((item) => item.id)
  const relationCount = selected.length - conceptIds.length
  const outsideCount = conceptIds.filter((id) => !viewGraph.concepts.some((concept) => concept.id === id)).length
  const concept = item?.kind === 'concept'
    ? graph.concepts.find((concept) => concept.id === item.id)
    : undefined
  const selectedEdge = item?.kind === 'relation'
    ? graph.relations.find((relation) => relationKey(relation) === item.id)
    : undefined
  const sourceLabel = selectedEdge
    ? (graph.concepts.find((item) => item.id === selectedEdge.source)?.label ?? '?')
    : null
  const targetLabel = selectedEdge
    ? (graph.concepts.find((item) => item.id === selectedEdge.target)?.label ?? '?')
    : null
  const selectedRelationId = selectedEdge?.predicate
  const selectedRelationLabel = selectedRelationId === activeVocab?.defaultTypeId
    ? ''
    : relationTypes.find((item) => item.id === selectedRelationId)?.label ?? ''

  return (
    <aside className="flex h-full flex-col gap-[26px] overflow-y-auto bg-background px-5 py-6 text-sm">
      {selected.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <h2 className="font-medium">{t('selection')}</h2>
          <p className="text-xs text-muted-foreground">{[
            conceptIds.length > 0 ? t('conceptCount', { count: conceptIds.length }) : '',
            relationCount > 0 ? t('relationCount', { count: relationCount }) : '',
          ].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-muted-foreground">{t('singleSelectionHint')}</p>
          {outsideCount > 0 && <p className="text-xs text-muted-foreground">{t('outsideConceptCount', { count: outsideCount })}</p>}
        </div>
      ) : concept ? (
        <section className="flex flex-col gap-[26px]">
          {outsideCount > 0 && <p className="text-xs text-muted-foreground">{t('outsideConcept')}</p>}
          <div className="flex flex-col gap-1.5">
            <Label>{t('label')}</Label>
            {readonly ? (
              <p className="text-[13px] leading-[19px] break-words">{concept.label}</p>
            ) : (
              <Input
                key={concept.id}
                id="concept-label"
                maxLength={maxConceptLabelLength}
                data-document-edit
                value={concept.label}
                onFocus={() => { textGroup.current = newIri() }}
                onBlur={() => { textGroup.current = undefined }}
                onChange={(event) => nessoStore.setConceptLabel(concept.id, event.target.value, textGroup.current ??= newIri())}
              />
            )}
          </div>
          <ConceptConnections key={`connections:${concept.id}`} conceptId={concept.id} readonly={readonly} />
        </section>
      ) : selectedEdge ? (
        <section className="flex flex-col gap-[26px]">
          {readonly ? (
            <div className="flex flex-col gap-1.5">
              <Label>{t('relation')}</Label>
              {selectedRelationLabel && <p className="text-[13px] leading-[19px] break-words">{selectedRelationLabel}</p>}
            </div>
          ) : (
            <RelationInput
              key={`${relationKey(selectedEdge)}:${selectedRelationLabel}`}
              edgeId={relationKey(selectedEdge)}
              typeId={selectedEdge.predicate}
              label={selectedRelationLabel}
              defaultTypeId={activeVocab?.defaultTypeId}
              relationTypes={relationTypes}
              onSave={nessoStore.setRelationType}
              onCreate={nessoStore.createRelationType}
            />
          )}
          <InspectorSection id="inspector.nodes" title={t('nodes')}>
            <div className="mt-2 space-y-3">
              <div className="flex flex-col gap-1"><span className="font-mono text-[10px] leading-[14px] text-muted-foreground">{t('from')}</span><span className="text-[13px] leading-[19px] break-words">{sourceLabel}</span></div>
              <div className="flex flex-col gap-1"><span className="font-mono text-[10px] leading-[14px] text-muted-foreground">{t('to')}</span><span className="text-[13px] leading-[19px] break-words">{targetLabel}</span></div>
            </div>
          </InspectorSection>
        </section>
      ) : null}
      {conceptIds.length > 0 && <ConceptViews key={JSON.stringify(conceptIds)} conceptIds={conceptIds} readonly={readonly} />}
    </aside>
  )
}
