import type { Notifications } from '@nesso/plugin'
import type { translate } from '../i18n/index.ts'
import type { AiEffects } from './effects.ts'

export function createAiApproval(notifications: Notifications, getTranslation: () => ReturnType<typeof translate>) {
  return (effects: AiEffects, signal: AbortSignal): Promise<boolean> => new Promise((resolve) => {
    if (signal.aborted) { resolve(false); return }
    const t = getTranslation()
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
    const groups = [effects.concepts, effects.relations, effects.relationTypes, effects.views]
    id = notifications.notify({
      tone: 'confirmation', title: t('aiApproval'),
      description: effects.reset ? t('aiResetApproval') : t('aiEditApproval', {
        added: groups.reduce((total, group) => total + group.added, 0),
        updated: groups.reduce((total, group) => total + group.updated, 0),
        removed: groups.reduce((total, group) => total + group.removed, 0),
        memberships: effects.memberships,
      }),
      action: { label: t('aiApply'), onClick: () => finish(true) },
      cancelAction: { label: t('cancel'), onClick: cancel },
    })
    if (settled) notifications.dismiss(id)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
  })
}
