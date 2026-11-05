import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Spinner } from '@nesso-how/ui'
import { pluginPanel, type usePluginPanel } from '../../plugins/index.ts'
import { useNessoStore } from '../../store/index.ts'
import { translate } from '../../i18n/index.ts'
import { defaultLocale } from '@nesso-how/i18n'

type PanelSnapshot = ReturnType<typeof usePluginPanel>

function PluginFrame({ id, panel }: { id: string; panel: PanelSnapshot }) {
  const element = useRef<HTMLIFrameElement>(null)
  useEffect(() => pluginPanel.mount(id, element.current!), [id])
  return (
    <iframe
      ref={element}
      title={panel ? `${panel.pluginName}: ${panel.title}` : 'Plugin panel'}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="plugin-panel-frame min-h-0 w-full flex-1 border-0"
      hidden={!panel}
      style={{
        visibility: panel?.status === 'ready' ? 'visible' : 'hidden',
        opacity: panel?.status === 'ready' ? 1 : 0,
      }}
    />
  )
}

export function PluginContent({ panel }: { panel: PanelSnapshot }) {
  useEffect(() => () => pluginPanel.close(), [])
  const frames = useSyncExternalStore(pluginPanel.subscribe, pluginPanel.getFrames)
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
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
      {frames.map(({ id }) => (
        <PluginFrame key={id} id={id} panel={panel?.frameId === id ? panel : null} />
      ))}
    </div>
  )
}
