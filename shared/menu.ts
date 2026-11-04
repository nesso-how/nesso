import { locales } from '@nesso-how/i18n'
import { z } from 'zod'

export const menuState = z.strictObject({
  locale: z.enum(locales),
  enabled: z.record(
    z.enum(['undo', 'redo', 'selectAll', 'settings', 'shortcuts', 'about']),
    z.boolean(),
  ),
})

export type MenuState = z.infer<typeof menuState>
export type MenuCommand = keyof MenuState['enabled']
export type NativeEditCommand = Extract<MenuCommand, 'undo' | 'redo' | 'selectAll'>

export type MenuBridge = {
  subscribe: (listener: (command: MenuCommand) => void) => () => void
  subscribeTabs: (listener: (index: number) => void) => () => void
  setState: (state: MenuState) => void
  edit: (command: NativeEditCommand) => void
}
