import { useEffect, useRef, useState, type RefObject } from 'react'
import { IconButton, PanelHeader, Spinner } from '@nesso-how/ui'
import { X } from 'lucide-react'
import { canvasTabActionIds, pluginPanel, usePluginPanel } from '../../plugins/index.ts'
import { useNessoStore } from '../../store/index.ts'
import { translate } from '../../i18n/index.ts'
import { defaultLocale } from '@nesso-how/i18n'

type PanelSnapshot = NonNullable<ReturnType<typeof usePluginPanel>>

function DelayedSpinner({ label }: { label: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 250)
    return () => clearTimeout(timer)
  }, [])
  if (!slow) return null
  return <Spinner className="plugin-panel-loading absolute inset-0" label={label} />
}

export function PluginContent({
  panel,
  canvas,
  viewName,
}: {
  panel: PanelSnapshot
  canvas: RefObject<HTMLDivElement | null>
  viewName?: string | null
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const id = panel.id
  useEffect(() => {
    const element = frame.current
    if (!element) return
    return pluginPanel.attach(element, id)
  }, [id, canvas])
  const title =
    viewName == null
      ? `${panel.pluginName}: ${panel.title}`
      : `${panel.pluginName}: ${panel.title} — ${viewName}`
  return (
    <div className="relative flex min-h-0 flex-1" aria-busy={panel.status === 'loading'}>
      {panel.status === 'loading' && (
        <DelayedSpinner key={`loading-${panel.id}`} label={t('pluginPanelLoading')} />
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
  )
}

export function PluginPanel({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const panel = usePluginPanel()
  const close = useRef<HTMLButtonElement>(null)
  const opened = useRef(false)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const tabbed = !!panel && canvasTabActionIds.includes(panel.actionId)
  const external = !!panel && !tabbed
  const id = panel?.id
  useEffect(() => {
    if (panel?.status === 'failed' && external) close.current?.focus()
  }, [panel?.status, external])
  useEffect(() => {
    if (!external) {
      if (!id) {
        if (opened.current)
          requestAnimationFrame(() => {
            if (!pluginPanel.getSnapshot()) canvas.current?.focus()
          })
        opened.current = false
      }
      return
    }
    opened.current = true
    close.current?.focus()
  }, [id, external, canvas])
  if (!panel || tabbed) return null
  const viewName = panel.viewName ?? t('completeGraph')
  const title = `${panel.pluginName}: ${panel.title} — ${viewName}`
  return (
    <section
      className="absolute inset-0 flex min-h-0 flex-col bg-background"
      aria-labelledby="plugin-panel-title"
      data-plugin-panel
    >
      <PanelHeader
        size="lg"
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2
            id="plugin-panel-title"
            aria-label={title}
            title={viewName}
            className="min-w-0 truncate text-[13px] font-medium"
          >
            {viewName}
          </h2>
          <span
            title={title}
            className="max-w-[30%] truncate border-l pl-3 text-xs text-muted-foreground"
          >
            {panel.title}
          </span>
        </div>
      </PanelHeader>
      <PluginContent panel={panel} canvas={canvas} viewName={viewName} />
    </section>
  )
}
