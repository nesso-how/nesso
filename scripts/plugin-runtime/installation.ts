import assert from 'node:assert/strict'
import { once } from 'node:events'
import { ipcMain, type BrowserWindow } from 'electron'
import { connectPlugins } from '../../electron/plugins.ts'
import { createTrustedRequest } from '../../electron/ipc.ts'
import { ElectronError } from '../../electron/errors.ts'
import { connectExternalLinks } from '../../electron/links.ts'
import { preparePluginPackage, parsePackageIdentity } from '../../packages/plugin/src/package.ts'
import theme from '../../packages/plugin/test/theme.json' with { type: 'json' }
import { connectFixtureStorage, countWorkers, waitFor, type CheckContext } from './helpers.ts'

const kinds = ['actions', 'theme', 'vocab'] as const
type Kind = (typeof kinds)[number]
const readScope =
  'When you run an action, it receives the concepts and relations in that view. Running it on All gives it access to the entire graph.'
const effectScope =
  'Changes to document content can affect the whole document, not just the view where you run an action.'
const fileScope =
  'The plugin can only read or save files through Nesso. It cannot browse your device.'
const notificationScope = 'Notifications appear inside Nesso, not as system notifications.'

type Driver = {
  evaluate: <T>(script: string) => Promise<T>
  click: (label: string, scope?: string) => Promise<void>
  open: (name: string) => Promise<void>
  records: () => Promise<{ name: string; version: string; enabled: boolean }[]>
  searchRows: () => Promise<string[]>
  toast: (title: string) => Promise<boolean>
  toastDescription: (title: string) => Promise<string>
  toastTitles: () => Promise<string[]>
  dismissToasts: () => Promise<number>
  stopVisible: () => Promise<boolean>
  discoveryNotice: () => Promise<boolean>
  attribution: () => Promise<{
    text: string
    links: { href: string; target: string; rel: string }[]
  }>
  declaredAccess: () => Promise<{ labels: string[]; notes: string[] } | null>
  search: (query: string) => Promise<void>
  approval: () => Promise<{
    open: boolean
    focused: string
    text: string
    count: number
    challenge?: string
  }>
  headerReady: (label: string) => Promise<boolean>
  activateTheme: (name: string) => Promise<void>
  preferenceSections: () => Promise<
    { title: string; fields: { label: string; value: string; disabled: boolean }[] }[]
  >
  settings: () => Promise<void>
}

function createDriver(window: BrowserWindow): Driver {
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const click = async (label: string, scope = '.settings-popup'): Promise<void> => {
    await evaluate<void>(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(`${scope} button`)})].find(button => button.textContent.trim() === ${JSON.stringify(label)});
    if (!button) throw new Error('Missing button: ' + ${JSON.stringify(label)});
    button.click();
  })()`)
  }
  const open = async (name: string): Promise<void> => {
    await evaluate<void>(`(() => {
    const button = [...document.querySelectorAll('.plugin-row button')].find(button => button.getClientRects().length && button.textContent.includes(${JSON.stringify(name)}));
    if (!button) throw new Error('Missing package row');
    button.click();
  })()`)
  }
  const toast = (title: string) =>
    waitFor(
      () =>
        evaluate<boolean>(
          `[...document.querySelectorAll('[data-slot="toast"]:not([data-leaving]) .toast-title')].some(heading => heading.textContent === ${JSON.stringify(title)})`,
        ),
      Boolean,
    )
  const settings = async () => {
    await waitFor(
      () => evaluate<boolean>(`!!document.querySelector('[data-settings-trigger]')`),
      Boolean,
    )
    await evaluate(`document.querySelector('[data-settings-trigger]').click()`)
    await click('Plugins', '.settings-sidebar')
  }
  const driver: Driver = {
    evaluate,
    click,
    open,
    records: () =>
      evaluate<{ name: string; version: string; enabled: boolean }[]>(
        `window.nessoPlugins.list().then(result => result.value.packages.map(({name,version,enabled}) => ({name,version,enabled})))`,
      ),
    searchRows: () =>
      evaluate<string[]>(
        `[...document.querySelectorAll('.plugin-row')].filter(row => row.getClientRects().length).map(row => row.innerText)`,
      ),
    toast,
    toastDescription: (title: string) =>
      evaluate<string>(
        `[...document.querySelectorAll('[data-slot="toast"]:not([data-leaving])')].find(toast => toast.querySelector('.toast-title')?.textContent === ${JSON.stringify(title)})?.querySelector('.toast-description')?.textContent`,
      ),
    toastTitles: () =>
      evaluate<string[]>(
        `[...document.querySelectorAll('.toast-title')].map(title => title.textContent)`,
      ),
    dismissToasts: () =>
      waitFor(
        () =>
          evaluate<number>(
            `(() => { document.querySelectorAll('.toast-close').forEach(button => button.click()); return document.querySelectorAll('[data-slot="toast"]').length; })()`,
          ),
        (count) => count === 0,
      ),
    stopVisible: () =>
      evaluate<boolean>(
        `[...document.querySelectorAll('.plugin-detail-footer button')].some(button => button.textContent.trim() === 'Stop actions')`,
      ),
    discoveryNotice: () =>
      evaluate<boolean>(
        `(() => { const footer = document.querySelector('.plugin-search-footer'); return !!footer && footer.getClientRects().length > 0 && !footer.closest('.plugin-scroll') && footer.textContent.includes('Results are not reviewed or audited by Nesso'); })()`,
      ),
    attribution: () =>
      evaluate<{ text: string; links: { href: string; target: string; rel: string }[] }>(
        `({text:document.querySelector('.plugin-scroll:not([hidden]) .plugin-attribution')?.textContent ?? '',links:[...document.querySelectorAll('.plugin-scroll:not([hidden]) .plugin-attribution a')].map(link => ({href:link.href,target:link.target,rel:link.rel}))})`,
      ),
    declaredAccess: () =>
      evaluate<{ labels: string[]; notes: string[] } | null>(
        `(() => { const heading = [...document.querySelectorAll('.plugin-scroll:not([hidden]) h3')].find(heading => heading.textContent === 'Declared access'); const section = heading?.closest('section'); return section ? { labels: [...section.querySelectorAll('li')].map(item => item.textContent), notes: [...section.querySelectorAll('p')].map(paragraph => paragraph.textContent) } : null; })()`,
      ),
    search: async (query: string) => {
      await evaluate<void>(
        `(() => { const input = document.querySelector('#plugin-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(query)}); input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
      )
      await evaluate<void>(`document.querySelector('#plugin-search').form.requestSubmit()`)
    },
    approval: () =>
      evaluate<{ open: boolean; focused: string; text: string; count: number; challenge?: string }>(
        `({open:!!document.querySelector('.plugin-approval[data-open]'),focused:document.activeElement?.textContent,text:document.querySelector('.plugin-approval[data-open]')?.textContent ?? '',count:window.__approvals.length,challenge:window.__approvals.at(-1)?.challenge})`,
      ),
    headerReady: (label: string) =>
      waitFor(
        () =>
          evaluate<boolean>(
            `[...document.querySelectorAll('.settings-popup button')].some(button => button.textContent.trim() === ${JSON.stringify(label)} && !button.disabled)`,
          ),
        Boolean,
      ),
    activateTheme: async (name: string) => {
      await click('Plugins', '.settings-sidebar')
      await open(name)
      await click('Use', '.plugin-detail-footer')
      await toast('Theme changed')
    },
    preferenceSections: () =>
      evaluate<{ title: string; fields: { label: string; value: string; disabled: boolean }[] }[]>(
        `['settings-interface', 'settings-vocabulary'].map(id => { const heading = document.getElementById(id); return { title: heading.textContent, fields: [...heading.closest('section').querySelectorAll('label')].map(label => { const trigger = document.getElementById(label.htmlFor); return { label: label.textContent, value: trigger.textContent, disabled: trigger.matches(':disabled, [aria-disabled="true"]') }; }) }; })`,
      ),
    settings,
  }
  return driver
}

type InstallState = {
  versions: Map<string, string>
  fault: boolean
  checkFault: boolean
  brokenActions: boolean
  metadataRequests: number
  searches: { query: string; offset: number }[]
  releaseSearch?: () => void
  openedLinks: string[]
  saved: Map<string, unknown>
}

async function buildFixture(state: InstallState, name: string, version: string) {
  const kind = kinds.find((kind) => name === `test-${kind}`)
  assert.ok(kind)
  const entry = kind === 'actions' ? 'index.js' : 'definition.json'
  const content =
    kind === 'actions'
      ? state.brokenActions
        ? 'export function create(){throw new Error("Broken plugin discovery")}'
        : 'export function create(){return [{id:"test-action",label:{en:"Test action"},async run({document}){const concept=document.getState().viewGraph.concepts[0];await document.setConceptLabel(concept.id,concept.label+"!");while(true){}}}]}'
      : JSON.stringify(
          kind === 'theme'
            ? { ...theme, id: 'test-theme' }
            : {
                id: 'test-vocab',
                relationTypes: [{ id: 'urn:nesso:test:relation', label: 'Test relation' }],
                defaultTypeId: 'urn:nesso:test:relation',
              },
        )
  return preparePluginPackage({
    manifest: {
      name,
      version,
      ...(kind === 'actions'
        ? {
            author: 'Test Author <private@example.test>',
            repository: 'git+https://github.com/example/plugin.git',
          }
        : {}),
      nesso: {
        apiVersion: 1,
        kind,
        entry,
        writes: kind === 'actions' ? ['concept.label'] : [],
        capabilities: kind === 'actions' && version >= '1.2.0' ? ['notifications'] : [],
      },
      i18n: {
        metadata: {
          name: { en: `Test ${kind}` },
          description: { en: `Test ${kind} package` },
          documentation: { en: 'Installation integration check' },
        },
      },
    },
    files: [{ path: entry, bytes: new TextEncoder().encode(content) }],
  })
}

function setupInstallation(window: BrowserWindow, saved: Map<string, unknown>): InstallState {
  const state: InstallState = {
    versions: new Map(kinds.map((kind) => [`test-${kind}`, '1.0.0'])),
    fault: false,
    checkFault: false,
    brokenActions: false,
    metadataRequests: 0,
    searches: [],
    openedLinks: [],
    saved,
  }
  connectExternalLinks(window.webContents, async (url) => {
    state.openedLinks.push(url)
  })
  connectPlugins(createTrustedRequest(false), async (input, signal) => {
    signal.throwIfAborted()
    if (state.fault)
      throw new ElectronError([{ path: 'npm', message: 'Acquisition validation failed' }])
    const { name, version } = parsePackageIdentity(input)
    return {
      ...(await buildFixture(state, name, version)),
      npmIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
    }
  })
  ipcMain.removeHandler('plugins:search')
  ipcMain.removeHandler('plugins:latest')
  ipcMain.handle('plugins:search', async (_event, query: string, offset = 0) => {
    state.metadataRequests++
    state.searches.push({ query, offset })
    if (query === 'error') return { issues: [{ path: 'npm', message: 'Search failed' }] }
    const packages = await Promise.all(
      [...state.versions].map(async ([name, version]) => {
        const { nesso, i18n, author, repository } = await buildFixture(state, name, version)
        return { name, version, nesso, i18n, author, repository }
      }),
    )
    if (query === 'pending') {
      await new Promise<void>((resolve) => {
        state.releaseSearch = resolve
      })
      return { value: { packages: packages.slice(0, 1) } }
    }
    const matches = packages.filter(({ name }) => name.includes(query))
    const next = offset + (query ? 1 : packages.length)
    return {
      value: { packages: matches.slice(offset, next), ...(next < matches.length ? { next } : {}) },
    }
  })
  ipcMain.handle('plugins:latest', async (_event, name: string) => {
    state.metadataRequests++
    if (state.checkFault) return { issues: [{ path: 'npm', message: 'Update check failed' }] }
    const version = state.versions.get(name)!
    const { nesso, i18n, author, repository } = await buildFixture(state, name, version)
    return { value: { name, version, nesso, i18n, author, repository } }
  })
  return state
}

async function verifyBundledDetails(driver: Driver) {
  for (const name of [
    '@nesso-how/kernel-theme',
    '@nesso-how/paper-theme',
    '@nesso-how/base-vocab',
    '@nesso-how/import',
    '@nesso-how/export',
  ]) {
    await driver.open(name)
    const actions = name === '@nesso-how/import' || name === '@nesso-how/export'
    const inUse = !actions && name !== '@nesso-how/paper-theme'
    const badges = await driver.evaluate<string[]>(
      `[...document.querySelector('.plugin-scroll:not([hidden]) .settings-page-title').parentElement.querySelectorAll('.settings-badge')].map(badge => badge.textContent)`,
    )
    assert.deepEqual(badges, inUse ? ['Enabled', 'In use'] : ['Enabled'])
    assert.deepEqual((await driver.attribution()).links, [])
    if (actions)
      assert.deepEqual(
        (await driver.declaredAccess())?.notes,
        name === '@nesso-how/import'
          ? [readScope, effectScope, fileScope]
          : [readScope, fileScope, notificationScope],
      )
    else assert.equal(await driver.declaredAccess(), null)
    assert.equal(
      await driver.evaluate<boolean>(
        `[...document.querySelectorAll('.plugin-scroll p')].some(paragraph => paragraph.textContent.trim() === 'In use')`,
      ),
      false,
    )
    assert.equal(
      await driver.evaluate<boolean>(
        `[...document.querySelectorAll('.plugin-detail-footer button')].some(button => button.textContent.trim() === 'Use' && button.disabled)`,
      ),
      inUse,
    )
    await driver.click('Plugins', '.settings-sidebar')
  }
}

async function verifyBundledThemeSwitch(driver: Driver, state: InstallState) {
  await waitFor(
    async () =>
      state.saved.get('document') as { workspace: { viewports: Record<string, unknown> } },
    (record) => Object.keys(record?.workspace.viewports ?? {}).length > 0,
  )
  const before = structuredClone(state.saved.get('document'))
  for (const [id, primary] of [
    ['paper-theme', '#934a35'],
    ['kernel-theme', '#393939'],
  ]) {
    await driver.activateTheme(`@nesso-how/${id}`)
    await waitFor(
      async () => state.saved.get('preferences') as { preferences: { activeThemeId: string } },
      (record) => record?.preferences.activeThemeId === id,
    )
    assert.equal(
      await driver.evaluate<string>(
        `getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()`,
      ),
      primary,
    )
    assert.deepEqual(state.saved.get('document'), before)
    await driver.dismissToasts()
  }
  await driver.click('Plugins', '.settings-sidebar')
}

async function verifyBrowse(driver: Driver, state: InstallState) {
  await driver.evaluate(
    `window.__approvals = []; window.__stopApprovalProbe = window.nessoPlugins.subscribe(event => { if(event.type === 'approval') window.__approvals.push(event.approval) }); true`,
  )
  await driver.click('Find on npm', '.plugin-tabs')
  await waitFor(
    () =>
      driver.evaluate<number>(
        `[...document.querySelectorAll('.plugin-row')].filter(row => row.getClientRects().length).length`,
      ),
    (count) => count === 3,
  )
  assert.equal(await driver.discoveryNotice(), true)
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-search .plugin-row')].every(row => getComputedStyle(row).borderBottomWidth === (row.nextElementSibling?.classList.contains('plugin-row') ? '1px' : '0px'))`,
    ),
    true,
  )
  assert.equal(
    await driver.evaluate<number>(
      `[...document.querySelectorAll('.plugin-row .settings-badge')].filter(badge => badge.getClientRects().length).length`,
    ),
    0,
  )
  assert.deepEqual(
    await driver.evaluate<string[]>(
      `[...document.querySelectorAll('.plugin-row .plugin-kind-icon')].filter(icon => icon.getClientRects().length).map(icon => icon.getAttribute('aria-label'))`,
    ),
    ['Actions', 'Theme', 'Vocabulary'],
  )
  await driver.search('no-matches')
  await waitFor(driver.searchRows, (rows) => rows.length === 0)
  assert.equal(await driver.discoveryNotice(), true)
  await driver.search('error')
  await waitFor(
    () =>
      driver.evaluate<boolean>(
        `document.querySelector('.plugin-settings').textContent.includes('Couldn’t reach npm')`,
      ),
    Boolean,
  )
  assert.equal(await driver.discoveryNotice(), true)
  await driver.click('Browse all')
  await waitFor(driver.searchRows, (rows) => rows.length === 3)
  console.log(
    'installation/desktop: Browse all resets pagination and replaces in-flight searches without stale results',
  )
  await driver.search('test')
  await waitFor(driver.searchRows, (rows) => rows.length === 1)
  await driver.click('Load more')
  await waitFor(driver.searchRows, (rows) => rows.length === 2)
  assert.deepEqual(state.searches.at(-1), { query: 'test', offset: 1 })
  await driver.search('pending')
  await waitFor(async () => !!state.releaseSearch, Boolean)
  assert.equal(await driver.discoveryNotice(), true)
  assert.equal(
    await driver.evaluate(
      `document.querySelector('section[aria-busy="true"] [role="status"]')?.textContent`,
    ),
    'Searching…',
  )
  assert.equal(
    await driver.evaluate<boolean>(
      `(() => { const section = document.querySelector('.plugin-search[aria-busy="true"]'); const form = section.querySelector('form').getBoundingClientRect(); const spinner = section.querySelector('.nesso-spinner').getBoundingClientRect(); return Math.abs(spinner.y + spinner.height / 2 - (form.bottom + section.getBoundingClientRect().bottom) / 2) < 2; })()`,
    ),
    true,
  )
  await driver.headerReady('Browse all')
  await driver.click('Browse all')
  await waitFor(driver.searchRows, (rows) => rows.length === 3)
  assert.deepEqual(state.searches.at(-1), { query: '', offset: 0 })
  assert.equal(await driver.evaluate<string>(`document.querySelector('#plugin-search').value`), '')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.settings-popup button')].some(button => button.textContent.trim() === 'Load more')`,
    ),
    false,
  )
  state.releaseSearch!()
  await driver.evaluate(
    `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
  )
  assert.equal((await driver.searchRows()).length, 3)
  const previousSearches = state.searches.length
  await driver.click('Browse all')
  await waitFor(
    async () => state.searches.length,
    (count) => count > previousSearches,
  )
  await waitFor(driver.searchRows, (rows) => rows.length === 3)
  assert.deepEqual(state.searches.at(-1), { query: '', offset: 0 })
}

async function installKind(
  driver: Driver,
  state: InstallState,
  kind: Kind,
  index: number,
  window: BrowserWindow,
) {
  await driver.open(`test-${kind}`)
  const access =
    kind === 'actions' ? { labels: ['Rename concepts'], notes: [readScope, effectScope] } : null
  assert.deepEqual(await driver.declaredAccess(), access)
  const details = await driver.attribution()
  assert.equal(
    await driver.evaluate<boolean>(
      `document.querySelector('.plugin-scroll:not([hidden]) .settings-page-description').nextElementSibling?.classList.contains('plugin-attribution')`,
    ),
    true,
  )
  assert.deepEqual(
    await driver.evaluate<string[]>(
      `[...document.querySelectorAll('.plugin-scroll:not([hidden]) .plugin-attribution a')].map(link => link.textContent)`,
    ),
    ['NPM', ...(kind === 'actions' ? ['Github'] : [])],
  )
  assert.deepEqual(
    details.links.map(({ href }) => href),
    [
      `https://www.npmjs.com/package/test-${kind}`,
      ...(kind === 'actions' ? ['https://github.com/example/plugin'] : []),
    ],
  )
  for (const link of details.links) {
    assert.equal(link.target, '_blank')
    assert.equal(link.rel, 'noopener noreferrer')
  }
  assert.equal(details.text.includes('By Test Author'), kind === 'actions')
  assert.equal(details.text.includes('private@example.test'), false)
  if (kind === 'actions')
    await verifyActionLinks(
      driver,
      state,
      details.links.map(({ href }) => href),
    )
  if (kind === 'actions') await verifyInstallFailure(driver, state)
  const approvalsBeforeInstall = (await driver.approval()).count
  await driver.click('Install', '.plugin-detail-footer')
  const prompt = await waitFor(
    driver.approval,
    (approvalState) => approvalState.open && approvalState.focused === 'Cancel',
  )
  assert.equal(prompt.count, approvalsBeforeInstall + 1)
  assert.ok(
    await driver.evaluate<boolean>(
      `window.nessoPlugins.approve('wrong-challenge', true).then(result => 'issues' in result)`,
    ),
  )
  await driver.click('Install', '.plugin-approval[data-open]')
  await waitFor(driver.records, (items) => items.length === index + 1)
  await driver.headerReady('Disable')
  assert.deepEqual(await driver.attribution(), details)
  assert.deepEqual(await driver.declaredAccess(), access)
  if (kind !== 'actions') await verifyUseUndo(driver, state, kind, window)
  assert.ok(
    await driver.evaluate<boolean>(
      `window.nessoPlugins.approve(${JSON.stringify(prompt.challenge)}, true).then(result => 'issues' in result)`,
    ),
  )
  await driver.click('Find on npm', '.plugin-scroll:not([hidden])')
  assert.equal(
    await driver.evaluate<number>(
      `[...document.querySelectorAll('.plugin-row .settings-badge')].filter(badge => badge.getClientRects().length).length`,
    ),
    index + 1,
  )
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-row .settings-badge')].filter(badge => badge.getClientRects().length).every(badge => badge.textContent === 'Installed')`,
    ),
    true,
  )
}

async function verifyActionLinks(driver: Driver, state: InstallState, hrefs: string[]) {
  for (const href of hrefs)
    await driver.evaluate(`document.querySelector('.plugin-attribution a[href="${href}"]').click()`)
  await waitFor(
    async () => state.openedLinks.length,
    (count) => count === 2,
  )
  assert.deepEqual(state.openedLinks, hrefs)
}

async function verifyInstallFailure(driver: Driver, state: InstallState) {
  state.fault = true
  await driver.click('Install', '.plugin-detail-footer')
  await driver.headerReady('Install')
  await driver.toast('Could not install plugin')
  assert.match(
    await driver.toastDescription('Could not install plugin'),
    /^Could not install test-actions@1.0.0 on this device\. Try again\./,
  )
  assert.match(
    await driver.toastDescription('Could not install plugin'),
    /Acquisition validation failed/,
  )
  await driver.dismissToasts()
  state.fault = false
  await driver.click('Install', '.plugin-detail-footer')
  await waitFor(driver.approval, (approvalState) => approvalState.open)
  await driver.click('Cancel', '.plugin-approval[data-open]')
  await driver.headerReady('Install')
  assert.deepEqual(await driver.records(), [])
  assert.deepEqual(await driver.toastTitles(), [])
}

async function verifyUseUndo(
  driver: Driver,
  state: InstallState,
  kind: 'theme' | 'vocab',
  window: BrowserWindow,
) {
  assert.equal(
    await driver.evaluate<string>(
      `document.querySelector('.plugin-detail-footer > div:first-child > button:first-child')?.textContent.trim()`,
    ),
    'Use',
  )
  const document = structuredClone(state.saved.get('document'))
  const key = kind === 'theme' ? 'activeThemeId' : 'activeVocabId'
  const preference = async () =>
    (state.saved.get('preferences') as { preferences: Record<typeof key, string> } | undefined)
      ?.preferences[key]
  const previous = await waitFor(preference, (id) => !!id)
  const title = kind === 'theme' ? 'Theme changed' : 'Vocabulary changed'
  await driver.click('Use', '.plugin-detail-footer')
  await waitFor(
    () =>
      driver.evaluate<boolean>(
        `[...document.querySelectorAll('.plugin-scroll:not([hidden]) .settings-badge')].some(badge => badge.textContent === 'In use')`,
      ),
    Boolean,
  )
  await waitFor(
    async () =>
      state.saved.get('preferences') as {
        preferences: { activeThemeId?: string; activeVocabId?: string }
      },
    (record) =>
      record?.preferences[kind === 'theme' ? 'activeThemeId' : 'activeVocabId'] === `test-${kind}`,
  )
  assert.deepEqual(state.saved.get('document'), document)
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-detail-footer button')].some(button => button.textContent.trim() === 'Use' && button.disabled)`,
    ),
    true,
  )
  await driver.toast(title)
  assert.equal(
    await driver.toastDescription(title),
    kind === 'theme'
      ? 'You’re now using Test theme. Your document is unchanged.'
      : 'You’re now using Test vocab for new relations. Existing relations are unchanged.',
  )
  await driver.click('Plugins', '.settings-sidebar')
  assert.equal(
    await driver.evaluate<boolean>(
      `(() => { const card = [...document.querySelectorAll('[data-slot="toast"]:not([data-leaving])')].find(card => card.querySelector('.toast-title')?.textContent === ${JSON.stringify(title)}); const button = [...card.querySelectorAll('button')].find(button => button.textContent === 'Undo'); button.focus(); return document.activeElement === button && !!button.closest('.settings-popup') && !button.closest('[aria-hidden="true"], [inert]'); })()`,
    ),
    true,
  )
  if (kind === 'theme') await verifyToastGeometry(driver, window)
  await driver.evaluate(`new Promise(resolve => requestAnimationFrame(resolve))`)
  assert.equal(
    await driver.evaluate<boolean>(
      `document.activeElement?.textContent === 'Undo' && !!document.querySelector('.settings-popup')`,
    ),
    true,
  )
  await driver.evaluate(`document.activeElement.click()`)
  await waitFor(preference, (id) => id === previous)
  assert.deepEqual(state.saved.get('document'), document)
  await driver.click('Find on npm', '.plugin-tabs')
  await driver.open(`test-${kind}`)
  await driver.headerReady('Use')
  await driver.click('Use', '.plugin-detail-footer')
  await waitFor(preference, (id) => id === `test-${kind}`)
}

async function verifyToastGeometry(driver: Driver, window: BrowserWindow) {
  const originalSize = window.getContentSize()
  for (const [width, height] of [
    [1200, 960],
    [800, 720],
  ]) {
    window.setContentSize(width, height)
    await driver.evaluate(
      `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    )
    assert.equal(
      await driver.evaluate<boolean>(`(() => {
      const viewport = document.querySelector('.toast-viewport');
      const rect = viewport.getBoundingClientRect();
      const popup = document.querySelector('.settings-popup').getBoundingClientRect();
      const button = document.activeElement;
      const action = button.getBoundingClientRect();
      return Math.abs(rect.bottom - (innerHeight - parseFloat(getComputedStyle(viewport).bottom))) < 2
        && Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 2
        && Math.abs(popup.left + popup.width / 2 - innerWidth / 2) < 2
        && Math.abs(popup.top + popup.height / 2 - innerHeight / 2) < 2
        && button.textContent === 'Undo'
        && button.contains(document.elementFromPoint(action.left + action.width / 2, action.top + action.height / 2));
    })()`),
      true,
      `Toasts remain window-positioned and interactive at ${width}×${height}`,
    )
  }
  window.setContentSize(originalSize[0], originalSize[1])
}

async function verifyFirstInstall(driver: Driver, state: InstallState, window: BrowserWindow) {
  console.log('installation/desktop: first-install approval for all kinds')
  for (const [index, kind] of kinds.entries()) await installKind(driver, state, kind, index, window)
  return (await driver.approval()).count
}

async function verifyUpdateToasts(driver: Driver) {
  console.log('installation/desktop: update checks use informative toasts without inline status')
  await driver.dismissToasts()
  await driver.click('Plugins', '.settings-sidebar')
  await driver.click('Check for updates')
  await driver.toast('No updates available')
  assert.equal(
    await driver.toastDescription('No updates available'),
    'No newer compatible versions are available for your installed plugins.',
  )
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-scroll:not([hidden]) [role="status"]')].some(status => status.textContent === 'Up to date' || status.textContent === 'No updates available')`,
    ),
    false,
  )
  await driver.dismissToasts()
  await driver.open('test-actions')
  assert.equal(
    await driver.evaluate<boolean>(
      `!!document.querySelector('.plugin-detail-footer [role="status"]')`,
    ),
    false,
  )
  await driver.click('Check for updates', '.plugin-detail-footer')
  await driver.toast('No updates available')
  assert.equal(
    await driver.toastDescription('No updates available'),
    'No newer compatible version is available for Test actions.',
  )
  assert.equal(
    await driver.evaluate<boolean>(
      `!!document.querySelector('.plugin-detail-footer [role="status"]')`,
    ),
    false,
  )
  await driver.dismissToasts()
}

async function verifyUpdateFailure(driver: Driver, state: InstallState) {
  state.checkFault = true
  await driver.click('Check for updates', '.plugin-detail-footer')
  await driver.toast('Could not check for updates')
  assert.equal(
    await driver.toastDescription('Could not check for updates'),
    'Could not check test-actions for a compatible update. Check your connection and try again.',
  )
  assert.deepEqual(await driver.toastTitles(), ['Could not check for updates'])
  assert.equal(
    await driver.evaluate<boolean>(
      `!!document.querySelector('.plugin-detail-footer [role="status"]')`,
    ),
    false,
  )
  state.checkFault = false
  await driver.dismissToasts()
  await driver.click('Plugins', '.settings-sidebar')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-scroll:not([hidden]) [role="status"]')].some(status => status.textContent === 'Up to date')`,
    ),
    false,
  )
  await driver.click('General', '.settings-sidebar')
  assert.deepEqual(await driver.preferenceSections(), [
    {
      title: 'Interface',
      fields: [
        { label: 'Language', value: 'English', disabled: false },
        { label: 'Theme', value: 'Test theme', disabled: false },
      ],
    },
    {
      title: 'Vocabulary',
      fields: [{ label: 'Active vocabulary', value: 'Test vocab', disabled: false }],
    },
  ])
}

async function verifyUndoGuards(driver: Driver, state: InstallState) {
  console.log('installation/desktop: Use undo does not overwrite a newer selection')
  await driver.dismissToasts()
  const beforeSupersededUndo = structuredClone(state.saved.get('document'))
  await driver.activateTheme('@nesso-how/kernel-theme')
  await driver.activateTheme('test-theme')
  await driver.headerReady('Disable')
  await driver.evaluate(
    `(() => { const card = [...document.querySelectorAll('[data-slot="toast"]:not([data-leaving])')].find(card => card.querySelector('.toast-description')?.textContent === 'You’re now using Kernel. Your document is unchanged.'); [...card.querySelectorAll('button')].find(button => button.textContent === 'Undo').click(); })()`,
  )
  await driver.toast('Could not undo selection')
  await waitFor(
    async () => state.saved.get('preferences') as { preferences: { activeThemeId: string } },
    (record) => record?.preferences.activeThemeId === 'test-theme',
  )
  assert.deepEqual(state.saved.get('document'), beforeSupersededUndo)
  console.log('installation/desktop: Use undo does not restore an unavailable provider')
  await driver.dismissToasts()
  const beforeUnavailableUndo = structuredClone(state.saved.get('document'))
  await driver.activateTheme('@nesso-how/kernel-theme')
  await driver.click('Plugins', '.settings-sidebar')
  await driver.open('test-theme')
  await driver.click('Disable', '.plugin-detail-footer')
  await driver.click('Disable', '[role="dialog"][data-open]:not(.settings-popup)')
  await driver.headerReady('Enable')
  await driver.click('Undo', '.toast-viewport')
  await driver.toast('Could not undo selection')
  assert.equal(
    await driver.toastDescription('Could not undo selection'),
    'Your selection has changed or the previous option is unavailable. Choose a theme or vocabulary in General settings.',
  )
  await waitFor(
    async () => state.saved.get('preferences') as { preferences: { activeThemeId: string } },
    (record) => record?.preferences.activeThemeId === 'kernel-theme',
  )
  assert.deepEqual(state.saved.get('document'), beforeUnavailableUndo)
  await driver.dismissToasts()
  await driver.click('Enable', '.plugin-detail-footer')
  await driver.headerReady('Use')
  await driver.click('Use', '.plugin-detail-footer')
  await driver.dismissToasts()
}

async function verifyStopDisable(driver: Driver, window: BrowserWindow) {
  console.log(
    'installation/desktop: Stop actions terminates busy workers without disabling future invocations',
  )
  await driver.click('Plugins', '.settings-sidebar')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-installed .plugin-row')].every(row => getComputedStyle(row).borderBottomWidth === (row.nextElementSibling?.classList.contains('plugin-row') ? '1px' : '0px'))`,
    ),
    true,
  )
  await driver.open('test-actions')
  assert.equal(await driver.stopVisible(), false)
  window.webContents.debugger.attach()
  const workers = () => countWorkers(window)
  const baselineWorkers = await workers()
  for (let invocation = 1; invocation <= 2; invocation++) {
    await driver.evaluate(
      `document.querySelector('.settings-popup button[aria-label="Close"]').click()`,
    )
    await driver.evaluate(`document.querySelector('[aria-label="Actions for All"]').click()`)
    await waitFor(
      () =>
        driver.evaluate<boolean>(
          `[...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === 'Test action')`,
        ),
      Boolean,
    )
    await driver.evaluate(
      `[...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === 'Test action').click()`,
    )
    await waitFor(
      () =>
        driver.evaluate<boolean>(
          `[...document.querySelectorAll('.react-flow__node span.text-center')].some(label => label.textContent.endsWith(${JSON.stringify('!'.repeat(invocation))}))`,
        ),
      Boolean,
    )
    await waitFor(workers, (count) => count > baselineWorkers)
    await driver.settings()
    await driver.open('test-actions')
    await waitFor(driver.stopVisible, Boolean)
    await driver.click('Stop actions', '.plugin-detail-footer')
    await waitFor(driver.stopVisible, (visible) => !visible)
    await waitFor(workers, (count) => count === baselineWorkers)
    assert.equal(
      await driver.evaluate<boolean>(`!!document.querySelector('iframe[title="test-actions"]')`),
      false,
    )
    assert.equal(
      (await driver.records()).find(({ name }) => name === 'test-actions')?.enabled,
      true,
    )
    assert.deepEqual(await driver.toastTitles(), [])
  }
  window.webContents.debugger.detach()
  await driver.click('Plugins', '.settings-sidebar')
  await driver.open('test-theme')
  await driver.click('Disable', '.plugin-detail-footer')
  await driver.click('Disable', '[role="dialog"][data-open]:not(.settings-popup)')
  await waitFor(driver.records, (items) =>
    items.some((item) => item.name === 'test-theme' && !item.enabled),
  )
  await driver.headerReady('Enable')
  assert.deepEqual(await driver.toastTitles(), [])
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-detail-footer button')].some(button => button.textContent.trim() === 'Use')`,
    ),
    false,
  )
  await driver.click('Enable', '.plugin-detail-footer')
  await waitFor(driver.records, (items) =>
    items.some((item) => item.name === 'test-theme' && item.enabled),
  )
  await driver.headerReady('Use')
  assert.deepEqual(await driver.toastTitles(), [])
  await driver.click('Disable', '.plugin-detail-footer')
  await driver.click('Disable', '[role="dialog"][data-open]:not(.settings-popup)')
  await waitFor(driver.records, (items) =>
    items.some((item) => item.name === 'test-theme' && !item.enabled),
  )
}

async function verifyRoutineUpdates(
  driver: Driver,
  state: InstallState,
  firstInstallApprovals: number,
) {
  for (const kind of kinds) state.versions.set(`test-${kind}`, '1.1.0')
  console.log('installation/desktop: routine updates and disabled-state preservation')
  await driver.click('Plugins', '.settings-sidebar')
  await driver.click('Check for updates')
  await driver.headerReady('Update plugins')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-settings [role="status"]')].some(status => status.textContent === 'Up to date')`,
    ),
    false,
  )
  await driver.click('Update plugins')
  await waitFor(
    driver.records,
    (items) => items.length === 3 && items.every(({ version }) => version === '1.1.0'),
  )
  assert.equal((await driver.approval()).count, firstInstallApprovals)
  assert.equal((await driver.records()).find(({ name }) => name === 'test-theme')?.enabled, false)
  await driver.headerReady('Check for updates')
  state.versions.set('test-actions', '1.2.0')
  console.log('installation/desktop: access-expansion decline and approval')
  await driver.click('Check for updates')
  await driver.headerReady('Update plugins')
  await driver.click('Update plugins')
  const expanded = await waitFor(driver.approval, (approvalState) => approvalState.open)
  assert.match(expanded.text, /Allow additional access/)
  assert.match(expanded.text, /Post Nesso notifications/)
  await driver.click('Cancel', '.plugin-approval[data-open]')
  await driver.headerReady('Update plugins')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-settings [role="status"]')].some(status => status.textContent.includes('Not updated:') && status.textContent.includes('test-actions@1.2.0'))`,
    ),
    true,
  )
  assert.deepEqual(await driver.toastTitles(), [])
  assert.equal(
    (await driver.records()).find(({ name }) => name === 'test-actions')?.version,
    '1.1.0',
  )
  console.log('installation/desktop: closing Settings invalidates pending approval')
  await driver.click('Update plugins')
  const cancelled = await waitFor(driver.approval, (approvalState) => approvalState.open)
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.plugin-settings [role="status"]')].some(status => status.textContent.includes('Not updated:'))`,
    ),
    false,
  )
  await driver.evaluate(
    `document.querySelector('.settings-popup button[aria-label="Close"]').click()`,
  )
  await waitFor(driver.approval, (approvalState) => !approvalState.open)
  assert.ok(
    await driver.evaluate<boolean>(
      `window.nessoPlugins.approve(${JSON.stringify(cancelled.challenge)}, true).then(result => 'issues' in result)`,
    ),
  )
  assert.equal(
    (await driver.records()).find(({ name }) => name === 'test-actions')?.version,
    '1.1.0',
  )
  assert.deepEqual(await driver.toastTitles(), [])
  await driver.settings()
  await driver.click('Check for updates')
  await driver.headerReady('Update plugins')
  await driver.click('Update plugins')
  await waitFor(driver.approval, (approvalState) => approvalState.open)
  await driver.click('Allow and update', '.plugin-approval[data-open]')
  await waitFor(driver.records, (items) =>
    items.some((item) => item.name === 'test-actions' && item.version === '1.2.0'),
  )
  await driver.headerReady('Check for updates')
  await driver.dismissToasts()
}

async function verifyFailures(driver: Driver, state: InstallState, window: BrowserWindow) {
  for (const kind of kinds) state.versions.set(`test-${kind}`, '1.3.0')
  state.fault = true
  console.log('installation/desktop: visible batch failures and offline restoration')
  await driver.click('Check for updates')
  await driver.headerReady('Update plugins')
  await driver.click('Update plugins')
  await driver.headerReady('Update plugins')
  await waitFor(
    () =>
      driver.evaluate<string[]>(
        `[...document.querySelectorAll('[data-slot="toast"][data-tone="warning"]')].map(toast => toast.textContent)`,
      ),
    (messages) =>
      kinds.every((kind) => messages.some((message) => message.includes(`test-${kind}@1.3.0`))),
  )
  assert.deepEqual(
    await driver.toastTitles(),
    kinds.map(() => 'Could not update plugin'),
  )
  assert.match(
    await driver.toastDescription('Could not update plugin'),
    /The previous installation is unchanged\./,
  )
  assert.match(
    await driver.toastDescription('Could not update plugin'),
    /Acquisition validation failed/,
  )
  assert.deepEqual((await driver.records()).map(({ version }) => version).sort(), [
    '1.1.0',
    '1.1.0',
    '1.2.0',
  ])
  const requestsBeforeReload = state.metadataRequests
  const reloaded = once(window.webContents, 'did-finish-load')
  window.reload()
  await reloaded
  await driver.settings()
  await waitFor(
    () =>
      driver.evaluate<number>(
        `[...document.querySelectorAll('.plugin-row')].filter(row => row.getClientRects().length).length`,
      ),
    (count) => count === 9,
  )
  assert.equal(state.metadataRequests, requestsBeforeReload)
  assert.equal(
    await driver.evaluate<boolean>(`!!document.querySelector('.plugin-approval[data-open]')`),
    false,
  )
  await driver.open('test-actions')
  assert.match((await driver.attribution()).text, /By Test Author/)
  assert.deepEqual(await driver.declaredAccess(), {
    labels: ['Rename concepts', 'Post Nesso notifications'],
    notes: [readScope, effectScope, notificationScope],
  })
  assert.deepEqual(
    (await driver.attribution()).links.map(({ href }) => href),
    ['https://www.npmjs.com/package/test-actions', 'https://github.com/example/plugin'],
  )
  await driver.click('Plugins', '.settings-sidebar')
  await driver.open('test-vocab')
  await driver.click('Remove plugin', '.plugin-detail-footer')
  await driver.click('Remove plugin', '[role="dialog"][data-open]:not(.settings-popup)')
  await waitFor(driver.records, (items) => items.length === 2)
  await driver.toast('Plugin removed')
  assert.equal(
    await driver.toastDescription('Plugin removed'),
    'Test vocab was removed from this device. Your document is unchanged.',
  )
  console.log(
    'installation/desktop: failed plugin discovery preserves the host and allows retry without reload',
  )
  state.fault = false
  state.brokenActions = true
  const started = await driver.evaluate<number>('performance.timeOrigin')
  await driver.open('test-actions')
  await driver.click('Check for updates', '.plugin-detail-footer')
  await driver.headerReady('Update')
  await driver.click('Update', '.plugin-detail-footer')
  await driver.headerReady('Check for updates')
  assert.equal(
    (await driver.records()).find(({ name }) => name === 'test-actions')?.version,
    '1.2.0',
  )
  assert.equal(
    await driver.evaluate<boolean>(`!!document.querySelector('#canvas .react-flow')`),
    true,
  )
  state.brokenActions = false
  await driver.click('Check for updates', '.plugin-detail-footer')
  await driver.headerReady('Update')
  await driver.click('Update', '.plugin-detail-footer')
  await waitFor(driver.records, (items) =>
    items.some(({ name, version }) => name === 'test-actions' && version === '1.3.0'),
  )
  await waitFor(
    () =>
      driver.evaluate<boolean>(
        `[...document.querySelectorAll('.plugin-detail-footer button')].some(button => button.textContent.trim() === 'Updated')`,
      ),
    Boolean,
  )
  assert.equal(await driver.evaluate<number>('performance.timeOrigin'), started)
  await driver.click('General', '.settings-sidebar')
  assert.equal(
    await driver.evaluate<boolean>(
      `[...document.querySelectorAll('.settings-popup button')].some(button => button.textContent.includes('Reload without external plugins'))`,
    ),
    false,
  )
}

export async function verifyInstallation({ window, url }: CheckContext) {
  const driver = createDriver(window)
  const saved = connectFixtureStorage()
  const state = setupInstallation(window, saved)
  await window.loadURL(url)
  await waitFor(() => driver.evaluate<boolean>(`!!document.querySelector('.intro')`), Boolean)
  await driver.click('Skip intro', '.intro')
  await driver.settings()
  await driver.click('General', '.settings-sidebar')
  assert.deepEqual(await driver.preferenceSections(), [
    {
      title: 'Interface',
      fields: [
        { label: 'Language', value: 'English', disabled: false },
        { label: 'Theme', value: 'Kernel', disabled: false },
      ],
    },
    {
      title: 'Vocabulary',
      fields: [{ label: 'Active vocabulary', value: 'Base Vocabulary', disabled: true }],
    },
  ])
  assert.equal(
    await driver.evaluate<boolean>(`!!document.getElementById('settings-providers')`),
    false,
  )
  await driver.click('Plugins', '.settings-sidebar')
  await verifyBundledDetails(driver)
  await verifyBundledThemeSwitch(driver, state)
  await verifyBrowse(driver, state)
  const firstInstallApprovals = await verifyFirstInstall(driver, state, window)
  await verifyUpdateToasts(driver)
  await verifyUpdateFailure(driver, state)
  await verifyUndoGuards(driver, state)
  await verifyStopDisable(driver, window)
  await verifyRoutineUpdates(driver, state, firstInstallApprovals)
  await verifyFailures(driver, state, window)
}
