// SPDX-License-Identifier: MIT

/** Maps FSRS lastRating 0–4 to CSS color vars. 1–4 use conf-1, conf-2, conf-4, conf-5 (skips --conf-3). */
const RATING_COLORS = [
  'var(--ink)',
  'var(--conf-1)',
  'var(--conf-2)',
  'var(--conf-4)',
  'var(--conf-5)',
] as const

export function ratingColor(rating: number, unratedFallback = 'var(--ink)'): string {
  const idx = Math.max(0, Math.min(4, rating))
  return idx === 0 ? unratedFallback : RATING_COLORS[idx]
}
