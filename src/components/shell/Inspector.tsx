import { relationKey, type RelationType } from '@nesso/schema'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
            className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </Autocomplete.Clear>
        </div>
        <Autocomplete.Portal>
          <Autocomplete.Positioner sideOffset={4} className="z-50 outline-none">
            <Autocomplete.Popup className="max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
              <Autocomplete.List>
                {(item: Readonly<RelationType>) => (
                  <Autocomplete.Item
                    key={item.id}
                    value={item}
                    onClick={() => onSave(edgeId, item.id)}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
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
  const [tagInput, setTagInput] = useState('')
  const graph = useNessoStore((state) => state.graph)
  const selected = useNessoStore((state) => state.selected)
  const focusId = useNessoStore((state) => state.focusId)
  const vocabs = useNessoStore((state) => state.vocabs)
  const activeVocabId = useNessoStore((state) => state.activeVocabId)
  const activeVocab = vocabs.find((vocab) => vocab.id === activeVocabId)
  const offered = new Map<string, Readonly<RelationType>>()
  for (const type of [...graph.relationTypes, ...(activeVocab?.relationTypes ?? [])]) {
    if (type.id !== activeVocab?.defaultTypeId && !offered.has(type.id)) offered.set(type.id, type)
  }
  const relationTypes = [...offered.values()]
  const selectedNode = selected?.kind === 'concept'
    ? graph.concepts.find((concept) => concept.id === selected.id)
    : undefined
  const selectedEdge = selected?.kind === 'relation'
    ? graph.relations.find((relation) => relationKey(relation) === selected.id)
    : undefined
  const concept = selectedEdge ? undefined : selectedNode ?? graph.concepts.find((item) => item.id === focusId)
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
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
      {concept ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Concept
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concept-label">Label</Label>
            <Input
              id="concept-label"
              value={concept.label}
              onChange={(event) => nessoStore.setConceptLabel(concept.id, event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concept-tags">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {concept.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`Remove ${tag} tag`}
                  onClick={() => nessoStore.removeTag(concept.id, tag)}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"
                >
                  {tag} <X className="size-3" />
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                nessoStore.addTags(concept.id, tagInput.split(' '))
                setTagInput('')
              }}
            >
              <Input
                id="concept-tags"
                value={tagInput}
                onChange={(event) => {
                  const next = event.target.value
                  const index = next.lastIndexOf(' ')
                  if (index === -1) {
                    setTagInput(next)
                    return
                  }
                  nessoStore.addTags(concept.id, next.slice(0, index).split(' '))
                  setTagInput(next.slice(index + 1))
                }}
                placeholder="Type a tag, press space…"
              />
            </form>
          </div>
        </section>
      ) : selectedEdge ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Relation
          </h2>
          <p className="text-muted-foreground">
            {sourceLabel} &rarr; {targetLabel}
          </p>
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
        </section>
      ) : null}
    </aside>
  )
}
