import { graphSchema, viewsSchema, type Graph } from './types.ts'
import { validationIssues } from '@nesso-how/errors'
import type { SchemaIssue } from './errors.ts'

export function validateGraph(graph: unknown, views: unknown = []): SchemaIssue[] {
  const result = graphSchema.safeParse(graph)
  if (!result.success) return validationIssues(result.error.issues)
  const viewResult = viewsSchema(result.data as Graph).safeParse(views)
  return viewResult.success ? [] : validationIssues(viewResult.error.issues, 'views')
}
