import { PluginError } from '@nesso-how/plugin'
import { describeError, type RendererLogEvent } from '../shared/logs.ts'

export function reportError(event: RendererLogEvent, error: unknown) {
  window.nessoLog?.error({ event, error: describeError(error) })
}

export function reportPluginFailure(plugin: string, error: unknown) {
  window.nessoLog?.error({
    event: 'plugin-failed',
    details: { plugin, code: error instanceof PluginError ? error.code : 'failed' },
  })
}
