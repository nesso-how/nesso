export type SchemaIssue = { path: string; message: string }

export class SchemaError extends Error {
  override name = 'SchemaError'
  readonly issues: SchemaIssue[]
  constructor(issues: SchemaIssue[]) {
    super(issues.map(({ path, message }) => (path ? `${path}: ${message}` : message)).join('\n'))
    this.issues = issues
  }
}

export function fail(path: string, message: string): never {
  throw new SchemaError([{ path, message }])
}
