import { z } from 'zod'
import { fileBase64 } from './files.ts'

export const imageRenderOptions = z.strictObject({
  format: z.literal('png'),
  scale: z.union([z.literal(2), z.literal(4)]).optional(),
})
export const renderedImage = z.strictObject({
  mediaType: z.literal('image/png'),
  base64: fileBase64,
})
export type ImageRenderOptions = Readonly<z.infer<typeof imageRenderOptions>>
export type RenderedImage = Readonly<z.infer<typeof renderedImage>>
