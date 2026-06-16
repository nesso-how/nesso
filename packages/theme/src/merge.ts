// SPDX-License-Identifier: MIT
import type { DeepPartial } from './types.js'

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Recursively merge `override` onto `base`; `undefined` values are skipped. */
export function deepMerge<T>(base: T, override: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T) ?? base
  }
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const prev = out[key]
    out[key] =
      isPlainObject(prev) && isPlainObject(value)
        ? deepMerge(prev, value as DeepPartial<typeof prev>)
        : value
  }
  return out as T
}
