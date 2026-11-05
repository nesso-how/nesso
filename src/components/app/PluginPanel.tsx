import { useEffect, useRef } from 'react'
import { Spinner } from '@nesso-how/ui'
import { pluginPanel, type usePluginPanel } from '../../plugins/index.ts'
import { useNessoStore } from '../../store/index.ts'
import { translate } from '../../i18n/index.ts'
import { defaultLocale } from '@nesso-how/i18n'
import { createPluginFrame } from '../../plugins/frame.ts'

type PanelSnapshot = ReturnType<typeof usePluginPanel>

export function PluginContent({ panel }: { panel: PanelSnapshot }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const runtime = useRef<ReturnType<typeof createPluginFrame> | null>(null)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const id = panel?.id
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const container = createPluginFrame(element, true)
    runtime.current = container
    return () => {
      runtime.current = null
      container.close()
    }
  }, [])
  useEffect(() => {
    if (!runtime.current || !id) return
    return pluginPanel.attach(runtime.current, id)
  }, [id])
  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col"
      style={{ display: panel ? undefined : 'none' }}
      inert={!panel}
      aria-busy={panel?.status === 'loading'}
      data-plugin-panel={panel ? '' : undefined}
    >
      {panel?.status === 'loading' && (
        <Spinner
          key={`loading-${panel.id}`}
          className="plugin-panel-loading absolute inset-0"
          label={t('pluginPanelLoading')}
        />
      )}
      {panel?.status === 'failed' && (
        <p role="alert" className="absolute inset-0 p-4 text-sm">
          {t('pluginPanelFailed')}
        </p>
      )}
      <iframe
        ref={frame}
        title={panel ? `${panel.pluginName}: ${panel.title}` : undefined}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="plugin-panel-frame min-h-0 w-full flex-1 border-0"
        style={{
          visibility: panel?.status === 'ready' ? 'visible' : 'hidden',
          opacity: panel?.status === 'ready' ? 1 : 0,
        }}
      />
    </div>
  )
}
