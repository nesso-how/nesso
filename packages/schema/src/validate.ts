import { graphSchema } from './types.ts'
import { validationIssues } from '@nesso-how/errors'
import type { SchemaIssue } from './errors.ts'

export function validateGraph(graph: unknown): SchemaIssue[] {
  const result = graphSchema.safeParse(graph)
  return result.success ? [] : validationIssues(result.error.issues)
}
