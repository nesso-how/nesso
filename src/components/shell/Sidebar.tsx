import type { Concept } from '@nesso/schema'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ResizeHandle } from '@/components/ui/resizable'
import { Sidebar } from '@/components/ui/sidebar'
import { useGraphStore } from '@/store/graph'

const MIN_WIDTH = 200
const MAX_WIDTH = 480

export function AppSidebar({ onResize }: { onResize: (width: number) => void }) {
  const concepts = useGraphStore((state) => state.graph.concepts)
  const focusId = useGraphStore((state) => state.focusId)
  const setFocus = useGraphStore((state) => state.setFocus)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const tags = [...new Set([...concepts.flatMap((concept) => concept.tags), ...selectedTags])].sort()
  const sorted = [...concepts].sort((a, b) => a.label.localeCompare(b.label))
  const filtered = sorted.filter((concept) => selectedTags.every((tag) => concept.tags.includes(tag)))

  const list = (items: Concept[]) => (
    <ul className="space-y-0.5">
      {items.map((concept) => (
        <li key={concept.id}>
          <button
            type="button"
            onClick={() => setFocus(concept.id)}
            aria-current={concept.id === focusId ? 'true' : undefined}
            className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent aria-current:bg-sidebar-accent"
          >
            {concept.label}
          </button>
        </li>
      ))}
    </ul>
  )

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    // Same approach as react-resizable-panels: imperative updates during the
    // gesture (no re-renders), React state commits once on pointer-up.
    const handle = event.currentTarget
    const wrapper = handle.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    handle.dataset.resizing = ''
    let width = 256
    const onMove = (move: PointerEvent) => {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, move.clientX))
      wrapper?.style.setProperty('--sidebar-width', `${width}px`)
    }
    const stop = () => {
      delete handle.dataset.resizing
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      onResize(width)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
  }

  return (
    <Sidebar>
      <div className="explorer-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <details className="mb-3 rounded-md border px-2 py-1.5 text-sm">
          <summary className="cursor-pointer select-none">
            Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
          </summary>
          <div className="mt-2 space-y-1 border-t pt-2">
            {tags.map((tag) => (
              <label key={tag} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={(event) =>
                    setSelectedTags((current) =>
                      event.target.checked ? [...current, tag] : current.filter((item) => item !== tag),
                    )
                  }
                />
                {tag}
              </label>
            ))}
          </div>
        </details>
        {selectedTags.length > 0 ? (
          list(filtered)
        ) : (
          <>
            {tags.map((tag) => {
              const items = sorted.filter((concept) => concept.tags.includes(tag))
              return items.length > 0 ? (
                <details key={tag} className="mb-2">
                  <summary className="cursor-pointer py-1 text-xs font-semibold text-muted-foreground">
                    {tag}
                  </summary>
                  {list(items)}
                </details>
              ) : null
            })}
            {sorted.some((concept) => concept.tags.length === 0) && (
              <details open className="mb-2">
                <summary className="cursor-pointer py-1 text-xs font-semibold text-muted-foreground">
                  Untagged
                </summary>
                {list(sorted.filter((concept) => concept.tags.length === 0))}
              </details>
            )}
          </>
        )}
        {selectedTags.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No concepts found</p>
        )}
      </div>
      <ResizeHandle
        onPointerDown={startResize}
        aria-label="Resize sidebar"
        className="absolute inset-y-0 right-0 z-20 cursor-col-resize bg-transparent"
      />
    </Sidebar>
  )
}
