import { AppWindow, Bell, Database, FolderOpen, Image } from 'lucide-react'
import type { PluginAccess as Access } from '../../../shared/plugins.ts'
import { useTranslation } from '@/i18n'
import { pluginAccessGroups } from '@/plugins/access'

const icons = {
  files: FolderOpen,
  images: Image,
  notifications: Bell,
  storage: Database,
  ui: AppWindow,
} as const

export function PluginAccess({ access }: { access: Access }) {
  const t = useTranslation()
  const { writes, capabilities } = pluginAccessGroups(access, t)
  if (!writes.length && !capabilities.length)
    return <p className="text-xs text-muted-foreground">{t('pluginNoAccess')}</p>
  return (
    <div className="plugin-access">
      {writes.length ? (
        <section className="plugin-access-group">
          <h4 className="plugin-access-heading">{t('pluginAccessWrites')}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {writes.map((label) => (
              <li key={label} className="settings-badge">
                {label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {capabilities.length ? (
        <section className="plugin-access-group">
          <h4 className="plugin-access-heading">{t('pluginAccessCapabilities')}</h4>
          <ul className="space-y-2">
            {capabilities.map(({ id, label }) => {
              const Icon = icons[id]
              return (
                <li key={id} className="flex items-start gap-2 text-xs leading-5">
                  <Icon
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
