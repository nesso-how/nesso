import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGraphStore } from '@/store/graph'

export function Inspector() {
  const [tagInput, setTagInput] = useState('')
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const focusId = useGraphStore((state) => state.focusId)
  const setConceptLabel = useGraphStore((state) => state.setConceptLabel)
  const addTags = useGraphStore((state) => state.addTags)
  const removeTag = useGraphStore((state) => state.removeTag)
  const setEdgeRelation = useGraphStore((state) => state.setEdgeRelation)
  const removeNode = useGraphStore((state) => state.removeNode)
  const removeEdge = useGraphStore((state) => state.removeEdge)
  const selectedNode = nodes.find((node) => node.selected)
  const selectedEdge = selectedNode ? undefined : edges.find((edge) => edge.selected)
  const concept = selectedEdge ? undefined : selectedNode ?? nodes.find((node) => node.id === focusId)
  const sourceLabel = selectedEdge
    ? (nodes.find((node) => node.id === selectedEdge.source)?.data.label ?? '?')
    : null
  const targetLabel = selectedEdge
    ? (nodes.find((node) => node.id === selectedEdge.target)?.data.label ?? '?')
    : null

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
              value={concept.data.label}
              onChange={(event) => setConceptLabel(concept.id, event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concept-tags">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {concept.data.tags.map((tag) => (
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
            disabled={nodes.length === 1}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relation-label">Relation</Label>
            <Input
              id="relation-label"
              value={selectedEdge.data?.relation ?? ''}
              onChange={(event) => setEdgeRelation(selectedEdge.id, event.target.value)}
              placeholder="Describe the relation"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            onClick={() => removeEdge(selectedEdge.id)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </section>
      ) : null}
    </aside>
  )
}
