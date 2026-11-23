import type { Locale } from '@nesso-how/i18n'
import type { PluginI18n, PluginManifest } from '@nesso-how/plugin/runtime'
import { ListRow, ListRowButton, ListRowDetail, ListRowTitle } from '@nesso-how/ui'
import { ChevronRight, Palette, Shapes, Zap } from 'lucide-react'
import { pluginMetadata } from '@/plugins'

export function PluginKindIcon({ kind, label }: { kind: PluginManifest['kind']; label?: string }) {
  const Icon = { actions: Zap, theme: Palette, vocab: Shapes }[kind]
  return (
    <span
      className="plugin-kind-icon"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      <Icon aria-hidden="true" />
    </span>
  )
}

export function PluginRow({
  entry,
  locale,
  badges,
  onClick,
}: {
  entry: {
    readonly name: string
    readonly version: string
    readonly kind: PluginManifest['kind']
    readonly i18n: PluginI18n
  }
  locale: Locale
  badges: readonly (string | undefined)[]
  onClick: () => void
}) {
  return (
    <ListRow className="plugin-row">
      <ListRowButton className="flex items-center gap-3" onClick={onClick}>
        <PluginKindIcon kind={entry.kind} />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 grow basis-40">
            <ListRowTitle>{pluginMetadata(entry, locale).name}</ListRowTitle>
            <ListRowDetail className="break-all">
              {entry.name}@{entry.version}
            </ListRowDetail>
          </span>
          <span className="flex flex-wrap gap-1">
            {badges.map(
              (badge) =>
                badge && (
                  <span className="settings-badge" key={badge}>
                    {badge}
                  </span>
                ),
            )}
          </span>
        </span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </ListRowButton>
    </ListRow>
  )
}
