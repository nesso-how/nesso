import { newIri, relationKey, type RelationType } from '@nesso/schema'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Input, Label } from '@nesso/ui'
import { ConceptViews } from './ConceptViews'
import { ConceptConnections } from './ConceptConnections'
import { InspectorSection } from './InspectorSection'
import { nessoStore, useNessoStore } from '@/store'

function RelationInput({ edgeId, typeId, label, defaultTypeId, relationTypes, onSave, onCreate }: {
  edgeId: string
  typeId: string
  label: string
  defaultTypeId: string | undefined
  relationTypes: readonly Readonly<RelationType>[]
  onSave: (id: string, typeId: string) => void
  onCreate: (id: string, label: string) => void
}) {
  const [value, setValue] = useState(label)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
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
      setError('Choose a relation type: this label has multiple IRIs.')
      setOpen(true)
      return
    }
    if (matches.length === 1) onSave(edgeId, matches[0].id)
    else onCreate(edgeId, trimmed)
    setValue(matches[0]?.label ?? trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="relation-label">Relation</Label>
      <Autocomplete.Root
        items={relationTypes}
        filteredItems={visible}
        itemToStringValue={(item) => item.label}
        value={value}
        open={open && visible.length > 0}
        onOpenChange={setOpen}
        onValueChange={(next, details) => {
          setValue(next)
          setError('')
          if (details.reason === 'clear-press' && defaultTypeId) onSave(edgeId, defaultTypeId)
        }}
        onItemHighlighted={(item) => { highlighted.current = item }}
        openOnInputClick
      >
        <div className="relative">
          <Autocomplete.Input
            id="relation-label"
            aria-invalid={Boolean(error)}
            render={<Input className="pr-7" />}
            onBlur={(event) => save(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !highlighted.current) save(event.currentTarget.value)
            }}
            placeholder="Choose or name a relation"
          />
          <Autocomplete.Clear
            aria-label="Clear relation"
            className="nesso-button absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </Autocomplete.Clear>
        </div>
        <Autocomplete.Portal>
          <Autocomplete.Positioner sideOffset={4} className="z-50 outline-none">
            <Autocomplete.Popup className="nesso-popup max-h-72 w-[var(--anchor-width)] overflow-y-auto p-1">
              <Autocomplete.List>
                {(item: Readonly<RelationType>) => (
                  <Autocomplete.Item
                    key={item.id}
                    value={item}
                    onClick={() => onSave(edgeId, item.id)}
                    className="nesso-option cursor-default px-2.5 py-2 text-xs"
                  >
                    {item.label}
                    {relationTypes.some((type) => type.id !== item.id && type.label.toLowerCase() === item.label.toLowerCase()) && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.id}</span>
                    )}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Inspector() {
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
  const concept = selected?.kind === 'concept'
    ? graph.concepts.find((concept) => concept.id === selected.id)
    : undefined
  const selectedEdge = selected?.kind === 'relation'
    ? graph.relations.find((relation) => relationKey(relation) === selected.id)
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
    <aside className="flex h-full flex-col overflow-y-auto bg-background px-5 py-6 text-sm">
      {concept ? (
        <section className="flex flex-col gap-[26px]">
          {!viewGraph.concepts.some((item) => item.id === concept.id) && <p className="text-xs text-muted-foreground">This concept is outside the current view.</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concept-label">Label</Label>
            <Input
              key={concept.id}
              id="concept-label"
              data-document-edit
              value={concept.label}
              onFocus={() => { textGroup.current = newIri() }}
              onBlur={() => { textGroup.current = undefined }}
              onChange={(event) => nessoStore.applyOperations([
                { kind: 'concept.label', id: concept.id, value: event.target.value },
              ], { historyGroup: textGroup.current ??= newIri() })}
            />
          </div>
          <ConceptConnections key={`connections:${concept.id}`} conceptId={concept.id} />
          <ConceptViews key={`views:${concept.id}`} conceptId={concept.id} />
        </section>
      ) : selectedEdge ? (
        <section className="flex flex-col gap-[26px]">
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
          <InspectorSection id="inspector.nodes" title="Nodes">
            <div className="mt-2 space-y-3">
              <div className="flex flex-col gap-1"><span className="font-mono text-[10px] leading-[14px] text-muted-foreground">From</span><span className="text-[13px] leading-[19px] break-words">{sourceLabel}</span></div>
              <div className="flex flex-col gap-1"><span className="font-mono text-[10px] leading-[14px] text-muted-foreground">To</span><span className="text-[13px] leading-[19px] break-words">{targetLabel}</span></div>
            </div>
          </InspectorSection>
        </section>
      ) : null}
    </aside>
  )
}
