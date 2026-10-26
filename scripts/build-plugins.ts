import { build } from 'vite'
import { readFile, writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { actionRunnerCsp } from '../shared/plugin-policy.ts'
import { parseDefinition, parsePluginI18n, parsePluginManifest } from '../packages/plugin/src/runtime.ts'

const root = path.resolve(import.meta.dirname, '..')
const script = (code: string) => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`
const html = (csp: string, body: string, style = '') => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${style}</style></head><body>${body}</body></html>`
const cache = path.join(root, 'node_modules/.tmp')
await mkdir(cache, { recursive: true })
const staging = await mkdtemp(path.join(cache, 'nesso-plugins-'))
const publish = async (file: string, content: string | Uint8Array) => {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, content)
  await rename(temporary, file)
}
try {
  for (const name of ['import', 'export']) {
    const directory = path.join(root, 'plugins', name)
    const source = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const manifest = parsePluginManifest(source.nesso)
    parsePluginI18n(source.i18n)
    await build({
      configFile: false, publicDir: false,
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        target: 'es2022', assetsInlineLimit: Infinity,
        lib: { entry: path.join(directory, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
        outDir: path.join(staging, name), emptyOutDir: true,
      },
    })
    const bytes = await readFile(path.join(staging, name, 'index.js'))
    await Promise.all([publish(path.join(root, 'public/preinstalled', name, 'index.js'), bytes), publish(path.join(directory, manifest.entry), bytes)])
  }
  for (const [name, kind] of [['kernel-theme', 'theme'], ['paper-theme', 'theme'], ['base-vocab', 'vocab']] as const) {
    const directory = path.join(root, 'plugins', name)
    const source = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const manifest = parsePluginManifest(source.nesso)
    if (manifest.kind !== kind) throw new Error(`Expected a ${kind} package: ${name}`)
    parsePluginI18n(source.i18n)
    const module = await import(pathToFileURL(path.join(directory, 'src/index.ts')).href) as { create: () => unknown }
    const definition = parseDefinition(kind, await module.create())
    const text = JSON.stringify(definition)
    await Promise.all([publish(path.join(root, 'public/preinstalled', name, 'definition.json'), text), publish(path.join(directory, manifest.entry), text)])
    if (kind === 'theme') {
      for (const [font, stem] of [['@fontsource-variable/geist', 'geist-{subset}-wght-normal'], ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-{subset}-400-normal']]) {
        const fontRoot = path.join(directory, 'node_modules', font)
        const ranges = JSON.parse(await readFile(path.join(fontRoot, 'unicode.json'), 'utf8'))
        for (const subset of Object.keys(ranges)) {
          const filename = `${stem.replace('{subset}', subset)}.woff2`
          const bytes = await readFile(path.join(fontRoot, 'files', filename))
          await Promise.all([publish(path.join(root, 'public/preinstalled', name, 'fonts', filename), bytes), publish(path.join(directory, 'fonts', filename), bytes)])
        }
      }
    }
  }
  const output = path.join(root, 'public/plugin-runner')
  for (const [entry, name] of [['guard', 'NessoGuard'], ['worker', 'NessoWorker'], ['action-relay', 'NessoActionRelay']]) {
    await build({
      configFile: false, publicDir: false,
      build: {
        target: 'es2022',
        lib: { entry: path.join(root, `packages/plugin/src/${entry}.ts`), formats: ['iife'], name, fileName: () => `${entry}.js` },
        outDir: path.join(staging, 'runner'), emptyOutDir: false,
      },
    })
  }
  const guard = await readFile(path.join(staging, 'runner/guard.js'), 'utf8')
  const guarded = (csp: string, title: string, content: string) => html(csp, `<iframe title="${title}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><template id="runner">${content}</template>${script(guard)}`, 'html,body,iframe{display:block;margin:0;height:100%;width:100%;border:0;overflow:hidden}')
  const worker = await readFile(path.join(staging, 'runner/worker.js'))
  const relay = await readFile(path.join(staging, 'runner/action-relay.js'), 'utf8')
  const action = html(actionRunnerCsp, `<script id="worker-source" type="application/json">data:text/javascript;base64,${worker.toString('base64')}</script>${script(relay)}`)
  await publish(path.join(output, 'actions.html'), guarded(actionRunnerCsp, 'Action worker', action))
} finally {
  await rm(staging, { recursive: true, force: true })
}
