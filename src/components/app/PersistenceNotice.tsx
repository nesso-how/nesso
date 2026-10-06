import { Notice } from '@nesso/ui'
import { ChevronRight } from 'lucide-react'
import { useNessoStore } from '@/store'

export function PersistenceNotice() {
  const issues = useNessoStore((state) => state.persistenceIssues)
  if (issues.length === 0) return null

  return (
    <Notice tone="warning" className="shrink-0 rounded-none border-x-0 border-b-0 p-0">
      <details className="group">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-sm px-3 py-2 leading-4 hover:bg-accent active:bg-pressed [&::-webkit-details-marker]:hidden [@media(pointer:coarse)]:min-h-11">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-state) group-open:rotate-90" />
          <span>Some changes couldn't be saved on this device.</span>
        </summary>
        <div className="px-3 pb-3">
          <p className="font-mono text-[10px] text-muted-foreground">Technical details</p>
          <ul className="mt-1 list-inside list-disc break-words text-muted-foreground">
            {issues.map(({ path, message }, index) => <li key={index}>{path}: {message}</li>)}
          </ul>
        </div>
      </details>
    </Notice>
  )
}
