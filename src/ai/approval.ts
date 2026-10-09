import type { Notifications } from '@nesso/plugin'
import type { AiEffects } from '@nesso/ai'
import type { translate } from '../i18n/index.ts'

const confirm = (notifications: Notifications, signal: AbortSignal, title: string, description: string, t: ReturnType<typeof translate>): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal.aborted) { resolve(false); return }
    let settled = false
    let id: string | undefined
    const finish = (approved: boolean) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', cancel)
      if (id !== undefined) notifications.dismiss(id)
      resolve(approved)
    }
    const cancel = () => finish(false)
    id = notifications.notify({
      tone: 'confirmation', title, description,
      action: { label: t('aiApply'), onClick: () => finish(true) },
      cancelAction: { label: t('cancel'), onClick: cancel },
    })
    if (settled) notifications.dismiss(id)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
  })

export function createAiApproval(notifications: Notifications, getTranslation: () => ReturnType<typeof translate>, title: 'aiApproval' | 'mcpApproval' = 'aiApproval') {
  return (effects: AiEffects, signal: AbortSignal) => {
    const t = getTranslation()
    const groups = [effects.concepts, effects.relations, effects.relationTypes, effects.views]
    return confirm(notifications, signal, t(title), t('aiEditApproval', {
      added: groups.reduce((total, group) => total + group.added, 0),
      updated: groups.reduce((total, group) => total + group.updated, 0),
      removed: groups.reduce((total, group) => total + group.removed, 0),
      memberships: effects.memberships,
    }), t)
  }
}

export function createAiHistoryApproval(notifications: Notifications, getTranslation: () => ReturnType<typeof translate>) {
  return (action: 'undo' | 'redo', signal: AbortSignal) => {
    const t = getTranslation()
    return confirm(notifications, signal, t('mcpApproval'), t(action === 'undo' ? 'mcpUndoApproval' : 'mcpRedoApproval'), t)
  }
}
