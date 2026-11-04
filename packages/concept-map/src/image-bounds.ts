import { NessoError } from '@nesso-how/errors'

export class ConceptMapImageError extends NessoError {
  override name = 'ConceptMapImageError'
}

export function imageBounds(
  rects: readonly { x: number; y: number; width: number; height: number }[],
  scale: number,
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
  if (
    ![left, top, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    width * scale > 8192 ||
    height * scale > 8192 ||
    width * height * scale * scale > 16_777_216
  )
    throw new ConceptMapImageError([
      { path: 'image', message: 'Image exceeds the dimension or pixel budget' },
    ])
  return { x: left - padding, y: top - padding, width, height }
}
