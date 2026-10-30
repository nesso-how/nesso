const runnerCsp =
  "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
export const actionRunnerCsp = runnerCsp.replace("worker-src 'none'", 'worker-src data:')
export const panelRunnerCsp = runnerCsp
export const desktopHostCsp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src nesso://app/plugin-runner/actions.html nesso://app/plugin-runner/panel.html"
