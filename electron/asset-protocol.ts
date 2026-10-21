import { net } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { actionRunnerCsp, desktopHostCsp } from '../shared/plugin-policy.ts'

export async function serveAppAsset(root: string, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const file = path.resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`)
  if (url.host !== 'app' || !file.startsWith(`${root}${path.sep}`)) return new Response(null, { status: 403 })
  const response = await net.fetch(pathToFileURL(file).href)
  response.headers.set('Content-Security-Policy', url.pathname === '/plugin-runner/actions.html' ? actionRunnerCsp : desktopHostCsp)
  return response
}
