import { Banner } from '@nesso/ui'
import { ChevronRight } from 'lucide-react'
import { useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'

export function PersistenceBanner() {
  const t = useTranslation()
  const issues = useNessoStore((state) => state.persistenceIssues)
  if (issues.length === 0) return null

  return (
    <Banner tone="warning" className="shrink-0 rounded-none border-x-0 border-b-0 p-0">
      <details className="group">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-sm px-3 py-2 leading-4 hover:bg-accent active:bg-pressed [&::-webkit-details-marker]:hidden [@media(pointer:coarse)]:min-h-11">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-state) group-open:rotate-90" />
          <span>{t('saveFailure')}</span>
        </summary>
        <div className="px-3 pb-3">
          <p className="font-mono text-[10px] text-muted-foreground">{t('technicalDetails')}</p>
          <ul className="mt-1 list-inside list-disc break-words text-muted-foreground">
            {issues.map(({ path, message }, index) => <li key={index}>{path}: {message}</li>)}
          </ul>
          <p className="mt-2 text-[11px] leading-4">
            <a href="https://github.com/nesso-how/nesso/discussions" target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">{t('getHelp')}</a>
          </p>
        </div>
      </details>
    </Banner>
  )
}
