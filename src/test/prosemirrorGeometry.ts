// SPDX-License-Identifier: MIT

/** Install the zero-geometry DOM methods ProseMirror needs in jsdom tests. */
export function installProseMirrorGeometryStubs(): void {
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
  })
  const zeroRects = (): DOMRectList => {
    const rects = [zeroRect()]
    return {
      length: rects.length,
      item: (index) => rects[index] ?? null,
      0: rects[0],
      [Symbol.iterator]: () => rects[Symbol.iterator](),
    }
  }

  for (const proto of [Element.prototype, Range.prototype]) {
    proto.getClientRects ??= zeroRects
    proto.getBoundingClientRect ??= zeroRect
  }
  Object.defineProperty(Text.prototype, 'getClientRects', { value: zeroRects })
  Object.defineProperty(Text.prototype, 'getBoundingClientRect', { value: zeroRect })
}
