import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import type { ActionDefinition, Notification, Plugin, PluginContext, RendererDefinition, ThemeDefinition, VocabDefinition } from '@nesso/plugin'

type Reject<T extends false> = T
type NotificationConfirmation = Extract<Notification, { readonly tone: 'confirmation' }>
type Accepts<K, T> = {
  readonly kind: K
  readonly metadata: Plugin['metadata']
  readonly operations: readonly []
  readonly create: (context: PluginContext) => T
} extends Plugin ? true : false

export type PluginContract = [
  Reject<Omit<NotificationConfirmation, 'action'> extends Notification ? true : false>,
  Reject<Omit<NotificationConfirmation, 'cancelAction'> extends Notification ? true : false>,
  Reject<Accepts<'renderer', readonly RendererDefinition[]>>,
  Reject<Accepts<'theme', readonly ThemeDefinition[]>>,
  Reject<Accepts<'vocab', readonly VocabDefinition[]>>,
  Reject<Accepts<'renderer', {
    readonly renderers: readonly RendererDefinition[]
    readonly actions: readonly ActionDefinition[]
  }>>,
  Reject<Accepts<'actions', {
    readonly themes: readonly ThemeDefinition[]
    readonly actions: readonly ActionDefinition[]
  }>>,
]

test('plugin contracts reject incomplete confirmations and incompatible contributions', () => {
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/typescript/bin/tsc', import.meta.url)),
    '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--types', 'node',
    '--module', 'preserve', '--moduleResolution', 'bundler', '--allowImportingTsExtensions',
    fileURLToPath(import.meta.url),
  ], { stdio: 'inherit' })
})
