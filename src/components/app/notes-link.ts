import { isAllowedNotesLink } from '../../../shared/link-policy'
import { notifications } from '@/notifications'

export async function openNotesLink(url: string, failure: string) {
  if (isAllowedNotesLink(url)) {
    try {
      if (window.nessoNotesLinks) {
        if (await window.nessoNotesLinks.open(url)) return
      } else {
        window.open(new URL(url).href, '_blank', 'noopener,noreferrer')
        return
      }
    } catch {}
  }
  notifications.api.notify({ tone: 'warning', title: failure })
}
