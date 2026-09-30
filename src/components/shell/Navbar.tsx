import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { actions } from '@/plugins'
import { useNessoStore } from '@/store'

export function Navbar() {
  const focusName = useNessoStore((state) =>
    state.graph.concepts.find((concept) => concept.id === state.focusId)?.label,
  )

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <span className="max-w-48 truncate text-sm font-semibold tracking-tight">{focusName}</span>
      <div className="ml-auto flex items-center gap-2">
        {actions.map((action) => (
          <Button key={action.id} size="sm" onClick={action.run}>
            {action.label}
          </Button>
        ))}
      </div>
    </header>
  )
}
