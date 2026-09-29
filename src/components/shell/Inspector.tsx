import { relationKey, type RelationType } from '@nesso/schema'
import { defaultRelationId } from '@nesso/vocab'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGraphStore } from '@/store/graph'

function RelationInput({ edgeId, label, relationTypes, onSave }: {
  edgeId: string
  label: string
  relationTypes: RelationType[]
  onSave: (id: string, label: string) => void
}) {
  const [value, setValue] = useState(label)
  const [open, setOpen] = useState(false)
  const options = relationTypes
    .filter((item) => item.id !== defaultRelationId)
    .map((item) => item.label)
  const query = value.trim().toLowerCase()
  const visible = options.filter((item) =>
    item.toLowerCase().includes(query) && item.toLowerCase() !== query)

  const save = (raw: string) => {
    const trimmed = raw.trim()
    onSave(edgeId, trimmed)
    setValue(relationTypes.find(
      (item) => item.label.toLowerCase() === trimmed.toLowerCase(),
    )?.label ?? trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="relation-label">Relation</Label>
      <Autocomplete.Root
        items={options}
        filteredItems={visible}
        value={value}
        open={open && visible.length > 0}
        onOpenChange={setOpen}
        onValueChange={(next, details) => {
          setValue(next)
          if (details.reason === 'item-press' || details.reason === 'clear-press') save(next)
        }}
        openOnInputClick
      >
        <div className="relative">
          <Autocomplete.Input
            id="relation-label"
            render={<Input className="pr-7" />}
            onBlur={(event) => save(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save(event.currentTarget.value)
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
                {(item: string) => (
                  <Autocomplete.Item
                    key={item}
                    value={item}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {item}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </div>
  )
}

export function Inspector() {
  const [tagInput, setTagInput] = useState('')
  const graph = useGraphStore((state) => state.graph)
  const selected = useGraphStore((state) => state.selected)
  const relationTypes = graph.relationTypes
  const focusId = useGraphStore((state) => state.focusId)
  const setConceptLabel = useGraphStore((state) => state.setConceptLabel)
  const addTags = useGraphStore((state) => state.addTags)
  const removeTag = useGraphStore((state) => state.removeTag)
  const setEdgeRelation = useGraphStore((state) => state.setEdgeRelation)
  const removeNode = useGraphStore((state) => state.removeNode)
  const removeEdge = useGraphStore((state) => state.removeEdge)
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
  const selectedRelationLabel = selectedRelationId === defaultRelationId
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
              onChange={(event) => setConceptLabel(concept.id, event.target.value)}
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
                  onClick={() => removeTag(concept.id, tag)}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"
                >
                  {tag} <X className="size-3" />
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                addTags(concept.id, tagInput.split(','))
                setTagInput('')
              }}
              className="flex gap-1"
            >
              <Input
                id="concept-tags"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Tag, tag…"
              />
              <Button type="submit" variant="outline" size="sm">Add</Button>
            </form>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            disabled={graph.concepts.length === 1}
            onClick={() => removeNode(concept.id)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
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
            key={relationKey(selectedEdge)}
            edgeId={relationKey(selectedEdge)}
            label={selectedRelationLabel}
            relationTypes={relationTypes}
            onSave={setEdgeRelation}
          />
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            onClick={() => removeEdge(relationKey(selectedEdge))}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </section>
      ) : null}
    </aside>
  )
}
