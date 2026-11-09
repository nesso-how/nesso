import { NessoError } from '@nesso-how/errors'

export class ConceptMapImageError extends NessoError {
  override name = 'ConceptMapImageError'
}

export function imageBounds(
  rects: readonly { x: number; y: number; width: number; height: number }[],
  maxScale: number,
) {
  const padding = 32
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const rect of rects) {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }
  const width = Math.ceil(right - left + padding * 2)
  const height = Math.ceil(bottom - top + padding * 2)
  const scale =
    [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0
      ? [4, 2, 1].find(
          (value) =>
            value <= maxScale &&
            width * value <= 8192 &&
            height * value <= 8192 &&
            width * height * value * value <= 16_777_216,
        )
      : undefined
  if (!scale)
    throw new ConceptMapImageError([
      { path: 'image', message: 'Image exceeds the dimension or pixel budget' },
    ])
  return { x: left - padding, y: top - padding, width, height, scale }
}
