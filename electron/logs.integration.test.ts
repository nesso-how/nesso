import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import type { App, IpcMain, IpcMainEvent } from 'electron'
import { logEntry } from '../shared/logs.ts'
import { ElectronError } from './errors.ts'
import { connectLogs, logError } from './logs.ts'

const fixture = (context: TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-logs-'))
  const monitors = process.listeners('uncaughtExceptionMonitor')
  const rejections = process.listeners('unhandledRejection')
  context.after(() => {
    for (const listener of process.listeners('uncaughtExceptionMonitor'))
      if (!monitors.includes(listener)) process.removeListener('uncaughtExceptionMonitor', listener)
    for (const listener of process.listeners('unhandledRejection'))
      if (!rejections.includes(listener)) process.removeListener('unhandledRejection', listener)
    rmSync(directory, { recursive: true, force: true })
  })
  context.mock.method(console, 'error', () => {})
  const app = Object.assign(new EventEmitter(), {
    getVersion: () => '1.2.3',
    getPath: () => directory,
  })
  const ipcMain = new EventEmitter()
  connectLogs(
    app as unknown as App,
    ipcMain as unknown as IpcMain,
    (event) => (event as unknown as { trusted: boolean }).trusted,
  )
  const entries = () =>
    readFileSync(path.join(directory, 'main.log'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => logEntry.parse(JSON.parse(line)))
  return { app, ipcMain, entries }
}

test('main process entries carry their context and redact paths, parsed content and URL queries', (context) => {
  const { app, entries } = fixture(context)
  logError(
    new ElectronError([{ path: 'storage', message: `Cannot read ${homedir()}/data/record.json` }]),
  )
  for (const source of ['private note', `[${'1,'.repeat(30)}private note]`])
    try {
      JSON.parse(source)
    } catch (error) {
      logError(error)
    }
  logError(new Error('GET https://example.com/nesso.zip?signature=secret failed'))
  app.emit('render-process-gone', {}, {}, { reason: 'clean-exit', exitCode: 0 })
  app.emit('render-process-gone', {}, {}, { reason: 'crashed', exitCode: 11 })
  const [start, error, ...rest] = entries()
  assert.partialDeepStrictEqual(start, { event: 'app-start', version: '1.2.3', process: 'main' })
  assert.partialDeepStrictEqual(error, {
    level: 'error',
    error: { issues: [{ path: 'storage', message: 'Cannot read ~/data/record.json' }] },
  })
  assert.deepEqual(
    rest.map((entry) => entry.error?.message ?? entry.details),
    [
      "Unexpected token 'p', is not valid JSON",
      "Unexpected token 'p', is not valid JSON",
      'GET https://example.com/nesso.zip failed',
      { reason: 'crashed', exitCode: 11 },
    ],
  )
  const text = JSON.stringify(entries())
  assert.doesNotMatch(text, /private|signature|secret/)
  assert.ok(!text.includes(homedir()))
})

test('renderer entries are accepted only from trusted, valid and rate-limited requests', (context) => {
  context.mock.timers.enable({ apis: ['Date'] })
  const { ipcMain, entries } = fixture(context)
  const send = (trusted: boolean, input: unknown) =>
    ipcMain.emit('logs:error', { trusted } as unknown as IpcMainEvent, input)
  const report = { event: 'error-boundary', error: { name: 'TypeError', message: 'failed' } }
  send(false, { ...report, error: { ...report.error, message: 'untrusted' } })
  send(true, { ...report, event: 'app-start' })
  send(true, { ...report, error: { ...report.error, message: 'x'.repeat(501) } })
  send(true, {
    ...report,
    details: Object.fromEntries([...Array(17).keys()].map((key) => [key, key])),
  })
  for (let index = 0; index < 60; index++) send(true, report)
  context.mock.timers.tick(60_000)
  send(true, { ...report, error: { ...report.error, message: 'next window' } })
  const messages = entries()
    .filter((entry) => entry.process === 'renderer')
    .map((entry) => entry.error?.message)
  assert.deepEqual(messages, [...Array(47).fill('failed'), 'next window'])
})
