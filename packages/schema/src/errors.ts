import { NessoError, validationIssues, type ErrorIssue } from '@nesso-how/errors'
import type { z } from 'zod'

export type SchemaIssue = ErrorIssue

export class SchemaError extends NessoError {
  override name = 'SchemaError'
}

export function parseSchema<T extends z.ZodType>(
  schema: T,
  value: unknown,
  path = '',
): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) throw new SchemaError(validationIssues(result.error.issues, path))
  return result.data
}

export function fail(path: string, message: string): never {
  throw new SchemaError([{ path, message }])
}
