import { NessoError, type ErrorIssue } from '@nesso-how/errors'

export type SchemaIssue = ErrorIssue

export class SchemaError extends NessoError {
  override name = 'SchemaError'
}

export function fail(path: string, message: string): never {
  throw new SchemaError([{ path, message }])
}
