import { z } from 'zod'
import { parseOrThrow } from './errors.ts'

export const fileTextLimit = 16 * 1024 * 1024
const mediaType = z
  .string()
  .max(128)
  .regex(/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/)
export const fileOpenOptions = z.strictObject({
  extensions: z
    .array(z.string().regex(/^[a-zA-Z0-9]{1,16}$/))
    .min(1)
    .max(16),
  mimeTypes: z.array(mediaType).max(16),
})
export const fileSaveOptions = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .regex(/^[^/\\]+$/)
    .refine(
      (value) =>
        value !== '.' &&
        value !== '..' &&
        [...value].every(
          (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
    ),
  mediaType,
  text: z
    .string()
    .max(fileTextLimit)
    .refine(
      (value) => new TextEncoder().encode(value).byteLength <= fileTextLimit,
      'File text byte limit exceeded',
    ),
})
export const fileOpenResult = z
  .strictObject({ name: z.string().min(1).max(240), mediaType, text: fileSaveOptions.shape.text })
  .nullable()
export type FileOpenOptions = z.infer<typeof fileOpenOptions>
export type FileSaveOptions = z.infer<typeof fileSaveOptions>
export type FileOpenResult = z.infer<typeof fileOpenResult>

export function parseFileOptions<K extends 'open' | 'save'>(
  kind: K,
  value: unknown,
): K extends 'open' ? FileOpenOptions : FileSaveOptions {
  return parseOrThrow(
    kind === 'open' ? fileOpenOptions : fileSaveOptions,
    value,
  ) as K extends 'open' ? FileOpenOptions : FileSaveOptions
}
