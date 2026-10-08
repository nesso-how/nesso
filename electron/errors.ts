export class ElectronError extends Error {
  override name = 'ElectronError'
  readonly issues: { path: string; message: string }[]
  constructor(issues: { path: string; message: string }[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    this.issues = issues
  }
}
