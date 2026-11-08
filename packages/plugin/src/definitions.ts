import { z } from 'zod'
import { validateGraph } from '@nesso-how/schema'
import { parseOrThrow } from './errors.ts'
import type { DeepReadonly, VocabDefinition } from '@nesso-how/core'

export const themeColors = [
  'background',
  'foreground',
  'canvas',
  'sidebar',
  'primary',
  'primary-hover',
  'primary-foreground',
  'muted',
  'muted-foreground',
  'hover',
  'pressed',
  'border',
  'ring',
  'selection-halo',
  'node-border',
  'edge',
  'handle',
] as const
const contributionId = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const color = z.string().regex(/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/)
const luminance = (value: string) => {
  const channels = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
const opaque = (value: string) => value.length === 7 || value.slice(7).toLowerCase() === 'ff'
const contrast = (left: string, right: string) =>
  (Math.max(luminance(left), luminance(right)) + 0.05) /
  (Math.min(luminance(left), luminance(right)) + 0.05)

const themeDefinition = z
  .strictObject({
    id: contributionId,
    colors: z.strictObject(
      Object.fromEntries(themeColors.map((key) => [key, color])) as Record<
        (typeof themeColors)[number],
        typeof color
      >,
    ),
    metrics: z.strictObject({
      'radius-control': z.number().min(0).max(16),
      'radius-object': z.number().min(0).max(16),
      'duration-state': z.number().int().min(0).max(300),
    }),
  })
  .superRefine(({ colors }, context) => {
    for (const key of ['background', 'canvas', 'sidebar'] as const) {
      if (!opaque(colors[key]) || luminance(colors[key]) < 0.8)
        context.addIssue({
          code: 'custom',
          path: ['colors', key],
          message: 'Expected an opaque light surface',
        })
      if (!opaque(colors.foreground) || contrast(colors.foreground, colors[key]) < 4.5)
        context.addIssue({
          code: 'custom',
          path: ['colors', 'foreground'],
          message: 'Insufficient foreground contrast',
        })
    }
    if (
      !opaque(colors.primary) ||
      !opaque(colors['primary-foreground']) ||
      contrast(colors.primary, colors['primary-foreground']) < 4.5
    )
      context.addIssue({
        code: 'custom',
        path: ['colors', 'primary-foreground'],
        message: 'Insufficient primary contrast',
      })
  })

export const vocabRelationType = z.strictObject({
  id: z.string().min(1).max(2048),
  label: z.string().max(30),
  translations: z
    .strictObject({
      en: z.string().trim().min(1).max(30).optional(),
      it: z.string().trim().min(1).max(30).optional(),
      'zh-CN': z.string().trim().min(1).max(30).optional(),
    })
    .optional(),
})

const vocabDefinition = z
  .strictObject({
    id: contributionId,
    relationTypes: z.array(vocabRelationType).min(1),
    defaultTypeId: z.string().min(1).max(2048),
  })
  .superRefine(({ relationTypes, defaultTypeId }, context) => {
    for (const issue of validateGraph({
      concepts: [],
      relations: [],
      relationTypes: relationTypes.map(({ id, label }) => ({ id, label })),
    }))
      context.addIssue({ code: 'custom', path: ['relationTypes'], message: issue.message })
    if (!relationTypes.some(({ id }) => id === defaultTypeId))
      context.addIssue({
        code: 'custom',
        path: ['defaultTypeId'],
        message: 'Default type must be offered by the vocabulary',
      })
  })

export type ThemeDefinition = DeepReadonly<z.infer<typeof themeDefinition>>
export type Definition = ThemeDefinition | VocabDefinition

export function parseDefinition(kind: 'theme', value: unknown): ThemeDefinition
export function parseDefinition(kind: 'vocab', value: unknown): VocabDefinition
export function parseDefinition(kind: 'theme' | 'vocab', value: unknown): Definition
export function parseDefinition(kind: 'theme' | 'vocab', value: unknown): Definition {
  return parseOrThrow(kind === 'theme' ? themeDefinition : vocabDefinition, value) as Definition
}
