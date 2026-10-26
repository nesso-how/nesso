import type { Locale } from '@nesso-how/i18n'
import type { PluginI18n, PluginManifest } from '@nesso-how/plugin/runtime'
import { ListRow, ListRowButton, ListRowDetail, ListRowTitle } from '@nesso-how/ui'
import { ChevronRight, Palette, Shapes, Zap } from 'lucide-react'
import { pluginMetadata } from '@/plugins'
import { translate } from '@/i18n'

export function PluginKindIcon({ kind, label }: { kind: PluginManifest['kind']; label: string }) {
  const Icon = { actions: Zap, theme: Palette, vocab: Shapes }[kind]
  return <span className="plugin-kind-icon" role="img" aria-label={label} title={label}><Icon aria-hidden="true" /></span>
}

export function PluginRow({ entry, locale, status, update, onClick }: {
  entry: { readonly name: string; readonly version: string; readonly kind: PluginManifest['kind']; readonly i18n: PluginI18n }
  locale: Locale
  status?: string
  update?: string
  onClick: () => void
}) {
  return <ListRow className="plugin-row">
    <ListRowButton className="flex items-center gap-3" onClick={onClick}>
      <PluginKindIcon kind={entry.kind} label={translate(locale)(entry.kind)} />
      <span className="min-w-0 flex-1"><ListRowTitle>{pluginMetadata(entry, locale).name}</ListRowTitle><ListRowDetail className="break-all">{entry.name}@{entry.version}</ListRowDetail></span>
      {(status || update) && <span className="flex shrink-0 flex-wrap justify-end gap-1">{status && <span className="settings-badge">{status}</span>}{update && <span className="settings-badge">{update}</span>}</span>}
      <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
    </ListRowButton>
  </ListRow>
}
