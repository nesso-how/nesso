import { parse } from 'es-module-lexer/minimal/js'
import { PluginError } from './errors.ts'
import type { ActionContribution } from './runtime.ts'

const moduleUrl = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`

export async function resolvePluginEntry(entry: string, source: string): Promise<string> {
  let code = new TextDecoder().decode(
    Uint8Array.from(atob(entry.slice(entry.indexOf(',') + 1)), (character) =>
      character.charCodeAt(0),
    ),
  )
  const [imports] = parse(code)
  const modules = {
    react: 'React',
    'react-dom': 'ReactDOM',
    'react-dom/client': 'ReactDOMClient',
    'react/jsx-runtime': 'JSXRuntime',
    'react/jsx-dev-runtime': 'JSXDevRuntime',
  } as const
  const replacements = imports.filter(({ n }) => n !== undefined && Object.hasOwn(modules, n))
  if (!replacements.length) return entry
  const runtime: typeof import('./react.ts') = await import(source)
  const urls = new Map<string, string>()
  for (const { n, s, e, d } of replacements.reverse()) {
    const name = n as keyof typeof modules
    let url = urls.get(name)
    if (!url) {
      const namespace = modules[name]
      const keys = Object.keys(runtime[namespace]).filter((key) => key !== 'default')
      url = moduleUrl(
        `import {${namespace} as value} from ${JSON.stringify(source)};export const {${keys.join(',')}}=value;export default value.default;`,
      )
      urls.set(name, url)
    }
    code = code.slice(0, s) + (d === -1 ? url : JSON.stringify(url)) + code.slice(e)
  }
  return moduleUrl(code)
}

const isComponent = (value: unknown) =>
  typeof value === 'function' ||
  (typeof value === 'object' &&
    value !== null &&
    '$$typeof' in value &&
    (value.$$typeof === Symbol.for('react.memo') || value.$$typeof === Symbol.for('react.lazy')))

export function validateActions(
  actions: unknown,
): asserts actions is readonly ActionContribution[] {
  if (
    !Array.isArray(actions) ||
    actions.some(
      (action) =>
        !action ||
        (action.ui !== undefined
          ? !isComponent(action.ui) || action.run !== undefined
          : typeof action.run !== 'function'),
    )
  )
    throw new PluginError('invalid-input', [
      { path: 'actions', message: 'Expected a run callback or UI component per action' },
    ])
}
