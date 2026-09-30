import { useNessoStore } from '@/store'

export function PersistenceNotice() {
  const issues = useNessoStore((state) => state.persistenceIssues)
  if (issues.length === 0) return null

  return (
    <details role="alert" className="shrink-0 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <summary>Local saving needs attention. Some changes may remain only in memory.</summary>
      <p className="mt-1">Unreadable saved data is kept untouched.</p>
      <ul className="mt-1 list-inside list-disc">
        {issues.map(({ path, message }, index) => <li key={index}>{path}: {message}</li>)}
      </ul>
    </details>
  )
}
