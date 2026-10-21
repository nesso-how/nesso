export type ErrorIssue = { path: string; message: string }

export class NessoError extends Error {
  override name = 'NessoError'
  readonly issues: ErrorIssue[]

  constructor(issues: ErrorIssue[]) {
    super(issues.map(({ path, message }) => path ? `${path}: ${message}` : message).join('\n'))
    this.issues = issues
  }
}
