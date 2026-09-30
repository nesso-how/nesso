import type { SchemaIssue } from '@nesso/schema'

export class NessoError extends Error {
  override name = 'NessoError'
  readonly issues: SchemaIssue[]

  constructor(issues: SchemaIssue[]) {
    super(issues.map(({ path, message }) => path ? `${path}: ${message}` : message).join('\n'))
    this.issues = issues
  }
}
