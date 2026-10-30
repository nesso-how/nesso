import { useEffect, useRef, type RefObject } from 'react'
import { IconButton, PanelHeader, Spinner } from '@nesso-how/ui'
import { ChevronRight, X } from 'lucide-react'
import { pluginPanel, usePluginPanel } from '../../plugins/index.ts'
import { useNessoStore } from '../../store/index.ts'
import { translate } from '../../i18n/index.ts'
import { defaultLocale } from '@nesso-how/i18n'

export function PluginPanel({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const panel = usePluginPanel()
  const frame = useRef<HTMLIFrameElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const opened = useRef(false)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const id = panel?.id
  useEffect(() => {
    if (panel?.status === 'failed') close.current?.focus()
  }, [panel?.status])
  useEffect(() => {
    if (!id) {
      if (opened.current)
        requestAnimationFrame(() => {
          if (!pluginPanel.getSnapshot()) canvas.current?.focus()
        })
      opened.current = false
      return
    }
    if (!frame.current) return
    opened.current = true
    close.current?.focus()
    return pluginPanel.attach(frame.current, id)
  }, [id, canvas])
  if (!panel) return null
  const viewName = panel.viewName ?? t('completeGraph')
  const title = `${panel.pluginName}: ${panel.title} — ${viewName}`
  return (
    <section
      className="absolute inset-0 flex min-h-0 flex-col bg-background"
      aria-labelledby="plugin-panel-title"
      data-plugin-panel
    >
      <PanelHeader
        actions={
          <IconButton
            ref={close}
            aria-label={t('pluginPanelReturn')}
            title={t('pluginPanelReturn')}
            onClick={pluginPanel.close}
          >
            <X />
          </IconButton>
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <h2
            id="plugin-panel-title"
            aria-label={title}
            title={title}
            className="flex min-w-0 items-center gap-2 text-[13px]"
          >
            <span className="shrink-0 text-xs text-muted-foreground">{panel.pluginName}</span>
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{panel.title}</span>
          </h2>
          <span
            title={viewName}
            className="max-w-[30%] truncate border-l pl-3 text-xs text-muted-foreground"
          >
            {viewName}
          </span>
        </div>
      </PanelHeader>
      <div className="relative flex min-h-0 flex-1" aria-busy={panel.status === 'loading'}>
        {panel.status === 'loading' && (
          <Spinner
            key={`loading-${panel.id}`}
            className="plugin-panel-loading absolute inset-0"
            label={t('pluginPanelLoading')}
          />
        )}
        {panel.status === 'failed' && (
          <p role="alert" className="absolute inset-0 p-4 text-sm">
            {t('pluginPanelFailed')}
          </p>
        )}
        <iframe
          key={panel.id}
          ref={frame}
          title={title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0 transition-opacity duration-150 motion-reduce:transition-none"
          style={{
            visibility: panel.status === 'ready' ? 'visible' : 'hidden',
            opacity: panel.status === 'ready' ? 1 : 0,
          }}
        />
      </div>
    </section>
  )
}
