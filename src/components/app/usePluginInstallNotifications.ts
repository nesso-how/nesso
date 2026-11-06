import { useEffect, useRef } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { translate } from '@/i18n'
import { notifications } from '@/notifications'
import { usePlugins, useExternalPluginsAvailable } from '@/plugins'
import { pluginMenuActions } from '@/plugins/registry'
import { host } from '@/store'

export function usePluginInstallNotifications(onShowCommands: () => void) {
  const plugins = usePlugins()
  const available = useExternalPluginsAvailable()
  const previousAvailable = useRef(available)
  const previous = useRef(plugins)
  useEffect(() => {
    const wasAvailable = previousAvailable.current
    const before = previous.current
    previousAvailable.current = available
    previous.current = plugins
    if (!wasAvailable || !available) return
    const installed = plugins.filter(
      (entry) => entry.contentId && !before.some(({ id }) => id === entry.id),
    )
    const locale = host.store.getState().preferences.locale ?? defaultLocale
    const t = translate(locale)
    for (const entry of installed) {
      const commands = pluginMenuActions(entry)
      if (!commands.length) continue
      notifications.api.notify({
        tone: 'info',
        title: t('pluginInstallDone'),
        description: t('pluginActionsAvailable', {
          commands: commands.map(({ label }) => label[locale] ?? label.en).join(', '),
        }),
        action: { label: t('pluginShowCommands'), onClick: onShowCommands },
      })
    }
  }, [plugins, available, onShowCommands])
}
