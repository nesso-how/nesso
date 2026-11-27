import type { App, IpcMain } from 'electron'
import log from 'electron-log/node'
import os from 'node:os'
import path from 'node:path'
import {
  describeError,
  rendererLog,
  type LogEntry,
  type LogEvent,
  type RendererLog,
} from '../shared/logs.ts'
import type { TrustedRequest } from './ipc.ts'

const RENDERER_LIMIT = 50
const RENDERER_WINDOW_MS = 60_000

for (const transport of Object.values(log.transports)) if (transport) transport.level = false
log.transports.file.maxSize = 1024 ** 2
log.transports.file.transforms = [({ data }) => JSON.stringify(data[0])]

let version = ''

const homes = [os.homedir(), os.homedir().replaceAll('\\', '/')].filter((home) => home.length > 1)
const redact = (value: unknown): unknown => {
  if (typeof value === 'string')
    return homes
      .reduce((text, home) => text.replaceAll(home, '~'), value)
      .replace(/(?:\.\.\.)?"[\s\S]*"(?:\.\.\.)? is not valid JSON/, 'is not valid JSON')
      .replace(/(\bhttps?:\/\/[^\s?#"'<>]*)\?[^\s#"'<>]*/g, '$1')
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]))
  return value
}

const write = (
  level: LogEntry['level'],
  source: LogEntry['process'],
  event: LogEvent,
  fields: Pick<RendererLog, 'error' | 'details'>,
) => {
  const entry: LogEntry = {
    v: 1,
    time: new Date().toISOString(),
    level,
    version,
    os: `${process.platform} ${os.release()} ${process.arch}`,
    process: source,
    event,
    ...(redact(fields) as typeof fields),
  }
  log[level](entry)
}

export function logError(error: unknown, event: LogEvent = 'error') {
  console.error(error)
  write('error', 'main', event, { error: describeError(error) })
}

export function logInfo(event: LogEvent, details?: RendererLog['details']) {
  write('info', 'main', event, { details })
}

export function connectLogs(app: App, ipcMain: IpcMain, trusted: TrustedRequest) {
  version = app.getVersion()
  log.transports.file.resolvePathFn = () => path.join(app.getPath('logs'), 'main.log')
  log.transports.file.level = 'info'
  logInfo('app-start')
  process.on('uncaughtExceptionMonitor', (error) =>
    write('error', 'main', 'uncaught-exception', { error: describeError(error) }),
  )
  process.on('unhandledRejection', (reason) => logError(reason, 'unhandled-rejection'))
  app.on('render-process-gone', (_event, _contents, { reason, exitCode }) => {
    if (reason !== 'clean-exit')
      write('error', 'main', 'render-process-gone', { details: { reason, exitCode } })
  })
  app.on('child-process-gone', (_event, { type, reason, exitCode, name, serviceName }) => {
    if (reason !== 'clean-exit')
      write('error', 'main', 'child-process-gone', {
        details: {
          type,
          reason,
          exitCode,
          ...(name ? { name } : {}),
          ...(serviceName ? { serviceName } : {}),
        },
      })
  })
  app.on('browser-window-created', (_event, window) =>
    window.on('unresponsive', () => write('error', 'main', 'unresponsive', {})),
  )
  app.on('web-contents-created', (_event, contents) =>
    contents.on('preload-error', (_event, _path, error) => logError(error, 'preload-error')),
  )
  let windowStart = 0
  let count = 0
  ipcMain.on('logs:error', (event, input: unknown) => {
    if (!trusted(event)) return
    const now = Date.now()
    if (now - windowStart >= RENDERER_WINDOW_MS) {
      windowStart = now
      count = 0
    }
    if (++count > RENDERER_LIMIT) return
    const parsed = rendererLog.safeParse(input)
    if (parsed.success)
      write('error', 'renderer', parsed.data.event, {
        error: parsed.data.error,
        details: parsed.data.details,
      })
  })
}
