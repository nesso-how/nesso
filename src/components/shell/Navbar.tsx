import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useGraphStore } from '@/store/graph'

export function Navbar() {
  const focusId = useGraphStore((state) => state.focusId)
  const focusName = useGraphStore((state) =>
    state.graph.concepts.find((concept) => concept.id === focusId)?.label,
  )
  const addConcept = useGraphStore((state) => state.addConcept)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <span className="max-w-48 truncate text-sm font-semibold tracking-tight">{focusName}</span>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" title={`Add concept linked to ${focusName}`} onClick={() => addConcept()}>
          <Plus data-icon="inline-start" />
          Concept
        </Button>
      </div>
    </header>
  )
}
