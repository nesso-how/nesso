export type ErrorIssue = { path: string; message: string }

export function validationIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
  prefix = '',
): ErrorIssue[] {
  return issues.map(({ path, message }) => ({
    path: path.reduce<string>(
      (result, key) =>
        typeof key === 'number'
          ? `${result}[${key}]`
          : result
            ? `${result}.${String(key)}`
            : String(key),
      prefix,
    ),
    message,
  }))
}

export class NessoError extends Error {
  override name = 'NessoError'
  readonly issues: ErrorIssue[]

  constructor(issues: ErrorIssue[]) {
    super(issues.map(({ path, message }) => (path ? `${path}: ${message}` : message)).join('\n'))
    this.issues = issues
  }
}
