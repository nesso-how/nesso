import type { Locale } from '@nesso-how/i18n'
import { gt, lte, prerelease, rcompare, valid } from 'semver'

export type ReleaseNotes = {
  version: string
  messages: Record<Locale, readonly string[]>
}

export function selectReleaseNotes(
  files: Record<string, ReleaseNotes['messages']>,
  current: string,
  previous?: string,
) {
  if (!valid(current) || (previous !== undefined && !valid(previous))) return []
  const stableOnly = previous !== undefined && !prerelease(previous) && !prerelease(current)
  return Object.entries(files)
    .map(([file, messages]) => ({ version: file.slice(file.lastIndexOf('/') + 1, -5), messages }))
    .filter(
      ({ version }) =>
        valid(version) &&
        lte(version, current) &&
        (!previous || gt(version, previous)) &&
        (!stableOnly || !prerelease(version)),
    )
    .sort((left, right) => rcompare(left.version, right.version))
}
