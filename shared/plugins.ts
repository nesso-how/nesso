import type { Locale } from '@nesso/i18n'
import { z } from 'zod'
import type { PluginPackageInput, PreparedPlugin } from '../packages/plugin/src/package.ts'

export type PluginResult<T> = { readonly value: T } | { readonly issues: readonly { readonly path: string; readonly message: string }[] }
export const npmIntegrity = z.string().regex(/^sha512-[A-Za-z0-9+/]{86}==$/)
export type InstalledPlugin = PreparedPlugin & { readonly enabled: boolean; readonly npmIntegrity?: string }
export type PluginBridge = {
  readonly list: () => Promise<PluginResult<{ readonly safeMode: boolean; readonly packages: readonly InstalledPlugin[] }>>
  readonly propose: (id: string, input: PluginPackageInput, locale: Locale, replacing?: string) => Promise<PluginResult<InstalledPlugin | null>>
  readonly installNpm: (id: string, input: { readonly name: string; readonly version: string }, locale: Locale, replacing?: string) => Promise<PluginResult<InstalledPlugin | null>>
  readonly settle: (id: string, contentId: string, valid: boolean) => Promise<PluginResult<null>>
  readonly cancel: (id: string) => void
  readonly remove: (contentId: string) => Promise<PluginResult<null>>
  readonly setEnabled: (contentId: string, enabled: boolean) => Promise<PluginResult<InstalledPlugin>>
  readonly subscribe: (listener: (event: { readonly type: 'install'; readonly id: string; readonly package: InstalledPlugin; readonly replacing?: string } | { readonly type: 'cancel'; readonly id: string }) => void) => () => void
}
