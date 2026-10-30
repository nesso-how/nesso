import { z } from 'zod'

export const aiDocumentationTopic = z.enum([
  'nesso',
  'ai',
  'plugin',
  'plugin-example',
  'schema',
  'concept-map',
  'ui',
])

export type AiDocumentation = Readonly<Record<z.infer<typeof aiDocumentationTopic>, string>>
