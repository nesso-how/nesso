import { useEffect, type RefObject } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import type { MenuState } from '../shared/menu.ts'
import type { HostStore } from './store/types.ts'
import { isEditableTarget } from './graph/interactions.ts'
import { historyShortcut, historyTarget } from './graph/editing-policy.ts'
import { graphSelection } from './graph/commands.ts'

export function useAppCommands({
  store,
  readonly,
  introOpen,
  pluginPanel,
  focusRef,
  openSettings,
  openSearch,
  openTab,
}: {
  store: HostStore
  readonly: boolean
  introOpen: boolean
  pluginPanel: boolean
  focusRef: RefObject<HTMLElement | null>
  openSettings: (page: string) => void
  openSearch: () => void
  openTab: (index: number) => void
}) {
  useEffect(() => {
    const menu = window.nessoMenu
    const context = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      const transferring = !!document.querySelector('[data-data-transfer][data-open]')
      const dialog = !!document.querySelector('[role="dialog"], [role="alertdialog"]')
      return {
        transferring,
        dialog,
        blocked: readonly || introOpen || pluginPanel || transferring || dialog,
        nativeEditing: isEditableTarget(target) || element?.tagName === 'IFRAME',
        documentEditing: !!element?.closest('[data-document-edit]'),
        canOpenSettings:
          !introOpen &&
          !transferring &&
          !document.querySelector('[role="dialog"]:not(.settings-popup), [role="alertdialog"]'),
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        const current = context(event.target)
        if (event.repeat || readonly || !current.canOpenSettings) return
        event.preventDefault()
        openSearch()
        return
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        const current = context(event.target)
        if (
          event.repeat ||
          current.nativeEditing ||
          !current.canOpenSettings ||
          readonly ||
          pluginPanel
        )
          return
        event.preventDefault()
        openSettings('shortcuts')
        return
      }
      const command = historyShortcut(event)
      if (!command || historyTarget(context(event.target)) !== 'document') return
      event.preventDefault()
      store[command]()
    }
    const stopMenu = menu?.subscribe((command) => {
      const current = context(document.activeElement)
      if (command === 'undo' || command === 'redo') {
        const target = historyTarget(current)
        if (target === 'document') store[command]()
        else if (target === 'native') menu.edit(command)
      } else if (command === 'selectAll') {
        if (current.nativeEditing) menu.edit(command)
        else if (!current.blocked) {
          store.setSelection(graphSelection(store.getState().viewGraph))
          focusRef.current?.focus()
        }
      } else if (current.canOpenSettings) {
        openSettings(command === 'settings' ? 'general' : command)
      }
    })
    const stopTabs = menu?.subscribeTabs((index) => {
      const current = context(document.activeElement)
      if (!readonly && !introOpen && !current.transferring && !current.dialog) openTab(index)
    })
    let previous = ''
    const update = () => {
      if (!menu) return
      const current = context(document.activeElement)
      const target = historyTarget(current)
      const { preferences, history } = store.getState()
      const state: MenuState = {
        locale: preferences.locale ?? defaultLocale,
        enabled: {
          undo: target === 'native' || (target === 'document' && history.canUndo),
          redo: target === 'native' || (target === 'document' && history.canRedo),
          selectAll: current.nativeEditing || !current.blocked,
          settings: current.canOpenSettings,
          shortcuts: current.canOpenSettings,
          about: current.canOpenSettings,
        },
      }
      const serialized = JSON.stringify(state)
      if (serialized === previous) return
      previous = serialized
      menu.setState(state)
    }
    let active = true
    const onFocus = () =>
      queueMicrotask(() => {
        if (active) update()
      })
    const stopStore = menu ? store.subscribe(update) : undefined
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    update()
    return () => {
      active = false
      stopMenu?.()
      stopTabs?.()
      stopStore?.()
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
    }
  }, [store, readonly, introOpen, pluginPanel, focusRef, openSettings, openSearch, openTab])
}
