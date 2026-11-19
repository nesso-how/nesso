import { graphSchema, mapsSchema, type Graph } from './types.ts'
import { validationIssues } from '@nesso-how/errors'
import type { SchemaIssue } from './errors.ts'

export function validateGraph(graph: unknown, maps: unknown = []): SchemaIssue[] {
  const result = graphSchema.safeParse(graph)
  if (!result.success) return validationIssues(result.error.issues)
  const mapResult = mapsSchema(result.data as Graph).safeParse(maps)
  return mapResult.success ? [] : validationIssues(mapResult.error.issues, 'maps')
}
