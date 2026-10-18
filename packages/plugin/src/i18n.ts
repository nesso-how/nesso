import { z } from 'zod'
import type { Locale } from '@nesso/i18n'

export type LocalizedText = Readonly<{ en: string } & Partial<Record<Locale, string>>>

export const text = (limit: number) => z.string().max(limit).refine((value) => new TextEncoder().encode(value).byteLength <= limit, 'Text byte limit exceeded')
export const localizedText = (limit: number) => z.strictObject({ en: text(limit).min(1), it: text(limit).min(1).optional(), 'zh-CN': text(limit).min(1).optional() })
export const resolvePluginText = (value: LocalizedText, locale: Locale): string => value[locale] ?? value.en
