// SPDX-License-Identifier: MIT

const RATING_COLORS = [
  'var(--ink, #1a1a1a)',
  'var(--conf-1, #ef4444)',
  'var(--conf-2, #f97316)',
  'var(--conf-4, #22c55e)',
  'var(--conf-5, #3b82f6)',
] as const

export function ratingColor(rating: number, unratedFallback = 'var(--ink, #1a1a1a)'): string {
  const idx = Math.max(0, Math.min(4, rating))
  return idx === 0 ? unratedFallback : RATING_COLORS[idx]
}
