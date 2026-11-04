import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron'
import type { TrustedRequest } from './ipc.ts'
import { ElectronError } from './errors.ts'
import { menuState, type MenuCommand, type MenuState } from '../shared/menu.ts'
import { isAllowedExternalLink } from '../shared/link-policy.ts'
import en from './menu-locales/en.json' with { type: 'json' }
import it from './menu-locales/it.json' with { type: 'json' }
import zhCN from './menu-locales/zh-CN.json' with { type: 'json' }

function openLink(url: string) {
  if (!isAllowedExternalLink(url)) return
  void shell
    .openExternal(url)
    .catch((error: unknown) =>
      console.error(
        new ElectronError([
          { path: 'menu.link', message: error instanceof Error ? error.message : String(error) },
        ]),
      ),
    )
}

function createMenuTemplate(state: MenuState, dev: boolean): MenuItemConstructorOptions[] {
  const mac = process.platform === 'darwin'
  const t = { en, it, 'zh-CN': zhCN }[state.locale]
  const command = (id: MenuCommand, accelerator?: string): MenuItemConstructorOptions => ({
    id,
    label: t[id],
    enabled: state.enabled[id],
    accelerator,
    click: (_item, window) => {
      if (window instanceof BrowserWindow) window.webContents.send('menu:command', id)
    },
  })
  const settings = command('settings', 'CmdOrCtrl+,')
  const about = command('about')
  return [
    ...(mac
      ? [
          {
            label: 'Nesso',
            submenu: [
              about,
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'services', label: t.services },
              { type: 'separator' },
              { role: 'hide', label: t.hide },
              { role: 'hideOthers', label: t.hideOthers },
              { role: 'unhide', label: t.unhide },
              { type: 'separator' },
              { role: 'quit', label: t.quit },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: t.file,
      submenu: [
        ...(!mac ? [settings, { type: 'separator' } as const] : []),
        { role: 'close', label: t.close },
        ...(!mac ? [{ role: 'quit', label: t.quit } as const] : []),
      ],
    },
    {
      label: t.edit,
      submenu: [
        command('undo', 'CmdOrCtrl+Z'),
        command('redo', mac ? 'Cmd+Shift+Z' : 'Ctrl+Y'),
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { type: 'separator' },
        command('selectAll', 'CmdOrCtrl+A'),
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: 'togglefullscreen', label: t.fullscreen },
        ...(dev
          ? [
              { type: 'separator' } as const,
              { role: 'reload', label: t.reload } as const,
              { role: 'toggleDevTools', label: t.devTools } as const,
            ]
          : []),
      ],
    },
    {
      role: 'windowMenu',
      label: t.window,
      submenu: [
        { role: 'minimize', label: t.minimize },
        ...(mac
          ? [
              { role: 'zoom', label: t.zoom } as const,
              { type: 'separator' } as const,
              { role: 'front', label: t.front } as const,
            ]
          : []),
      ],
    },
    {
      role: 'help',
      label: t.help,
      submenu: [
        command('shortcuts'),
        {
          label: t.documentation,
          click: () => openLink('https://github.com/nesso-how/nesso#readme'),
        },
        {
          label: t.reportIssue,
          click: () => openLink('https://github.com/nesso-how/nesso/issues/new/choose'),
        },
        ...(!mac ? [{ type: 'separator' } as const, about] : []),
      ],
    },
  ]
}

export function connectTabShortcuts(contents: WebContents) {
  const mac = process.platform === 'darwin'
  contents.on('before-input-event', (event, input) => {
    const digit = /^Digit([1-9])$/.exec(input.code)
    if (!digit || input.type !== 'keyDown' || input.shift || input.alt) return
    if (!(mac ? input.meta : input.control)) return
    event.preventDefault()
    if (!input.isAutoRepeat) contents.send('menu:tab', Number(digit[1]) - 1)
  })
}

export function connectMenu(trusted: TrustedRequest, dev: boolean) {
  const empty: MenuState = {
    locale: 'en',
    enabled: {
      undo: false,
      redo: false,
      selectAll: false,
      settings: false,
      shortcuts: false,
      about: false,
    },
  }
  let state = empty
  const install = () =>
    Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(state, dev)))
  install()
  ipcMain.on('menu:state', (event, input: unknown) => {
    if (!trusted(event)) return
    const parsed = menuState.safeParse(input)
    if (!parsed.success) return
    const changedLocale = state.locale !== parsed.data.locale
    state = parsed.data
    if (changedLocale) return install()
    const menu = Menu.getApplicationMenu()
    for (const [id, enabled] of Object.entries(state.enabled)) {
      const item = menu?.getMenuItemById(id)
      if (item) item.enabled = enabled
    }
  })
  ipcMain.on('menu:edit', (event, command: unknown) => {
    if (trusted(event) && (command === 'undo' || command === 'redo' || command === 'selectAll'))
      event.sender[command]()
  })
  app.on('window-all-closed', () => {
    state = { ...empty, locale: state.locale }
    install()
  })
}
