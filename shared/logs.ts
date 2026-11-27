import { NessoError } from '@nesso-how/errors'
import { z } from 'zod'

const limits = { name: 128, message: 500, issues: 32, details: 16, stack: 4000 }

const errorSchema = z.strictObject({
  name: z.string().max(limits.name),
  message: z.string().max(limits.message),
  code: z.string().max(limits.name).optional(),
  issues: z
    .array(
      z.strictObject({
        path: z.string().max(limits.message),
        message: z.string().max(limits.message),
      }),
    )
    .max(limits.issues)
    .optional(),
  stack: z.string().max(limits.stack).optional(),
})

type LogError = z.infer<typeof errorSchema>

const details = z
  .record(z.string().max(64), z.union([z.string().max(limits.message), z.number(), z.boolean()]))
  .refine((value) => Object.keys(value).length <= limits.details)

const rendererLogEvents = [
  'window-error',
  'unhandled-rejection',
  'error-boundary',
  'plugin-failed',
] as const

export type RendererLogEvent = (typeof rendererLogEvents)[number]

const logEvents = [
  ...rendererLogEvents,
  'error',
  'app-start',
  'update',
  'uncaught-exception',
  'render-process-gone',
  'child-process-gone',
  'unresponsive',
  'preload-error',
] as const

export type LogEvent = (typeof logEvents)[number]

export const rendererLog = z.strictObject({
  event: z.enum(rendererLogEvents),
  error: errorSchema.optional(),
  details: details.optional(),
})

export type RendererLog = z.infer<typeof rendererLog>

export const logEntry = z.strictObject({
  v: z.literal(1),
  time: z.iso.datetime(),
  level: z.enum(['info', 'error']),
  version: z.string(),
  os: z.string(),
  process: z.enum(['main', 'renderer']),
  event: z.enum(logEvents),
  error: errorSchema.optional(),
  details: details.optional(),
})

export type LogEntry = z.infer<typeof logEntry>

export type LogBridge = {
  error: (log: RendererLog) => void
}

export function describeError(error: unknown): LogError {
  const bound = (value: string, max = limits.message) => value.slice(0, max)
  if (!(error instanceof Error))
    return { name: typeof error, message: bound(typeof error === 'string' ? error : '') }
  const code = (error as { code?: unknown }).code
  return {
    name: bound(error.name, limits.name),
    message: bound(error.message),
    ...(typeof code === 'string' || typeof code === 'number'
      ? { code: bound(String(code), limits.name) }
      : {}),
    ...(error instanceof NessoError
      ? {
          issues: error.issues
            .slice(0, limits.issues)
            .map(({ path, message }) => ({ path: bound(path), message: bound(message) })),
        }
      : {}),
    ...(error.stack ? { stack: bound(error.stack, limits.stack) } : {}),
  }
}
