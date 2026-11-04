import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@nesso-how/ui'
import { pluginPanel, type usePluginPanel } from '../../plugins/index.ts'
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

export function PluginContent({ panel }: { panel: PanelSnapshot }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const id = panel.id
  useEffect(() => {
    const element = frame.current
    if (!element) return
    return pluginPanel.attach(element, id)
  }, [id])
  return (
    <div
      className="relative flex min-h-0 flex-1"
      aria-busy={panel.status === 'loading'}
      data-plugin-panel
    >
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
        title={`${panel.pluginName}: ${panel.title}`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 border-0"
        style={{
          visibility: panel.status === 'ready' ? 'visible' : 'hidden',
        }}
      />
    </div>
  )
}
