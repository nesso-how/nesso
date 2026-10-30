import type { messages } from '../i18n.ts'

export function formatInterval(
  date: Date,
  time: Date,
  t: (typeof messages)[keyof typeof messages],
) {
  const minutes = Math.max(1, Math.round((date.getTime() - time.getTime()) / 60000))
  if (date <= time) return t.now
  if (minutes < 60) return `${minutes} ${t.minute}`
  if (minutes < 1440) return `${Math.round(minutes / 60)} ${t.hour}`
  return `${Math.max(1, Math.round(minutes / 1440))} ${t.day}`
}
