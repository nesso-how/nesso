import assert from 'node:assert/strict'
import test from 'node:test'
import { draw, readTheme } from './draw.ts'

const bubbles = ['a', 'b', 'c'].map((id, index) => ({
  id,
  label: id,
  x: 100 * (index + 1),
  y: 50,
  radius: 10,
}))

function render(k: number) {
  const labels: { label: string; font: string; x: number; y: number; outline: number }[] = []
  const boxes: { x: number; y: number; width: number; height: number }[] = []
  const context = {
    canvas: { width: 800, height: 600 },
    font: '',
    lineWidth: 0,
    fillRect: (x: number, y: number, width: number, height: number) => {
      boxes.push({ x, y, width, height })
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    strokeText: () => {},
    fillText: (label: string, x: number, y: number) => {
      labels.push({ label, font: context.font, x, y, outline: context.lineWidth })
    },
    measureText: (label: string) => ({ width: label.length * parseFloat(context.font) * 0.6 }),
  } as unknown as CanvasRenderingContext2D
  draw(
    context,
    {
      bubbles,
      lines: [{ id: 'a-b', predicate: 'p', source: bubbles[0], target: bubbles[1] }],
      labels: new Map([['p', 'relates to']]),
    },
    { ...readTheme(() => '#fff'), 'font-sans': 'sans-serif', 'font-mono': 'monospace' },
    { x: 0, y: 0, k },
    { concepts: new Set(['a']), relations: new Set(), hovered: 'b' },
  )
  return { labels, boxes }
}

test('all labels and backgrounds shrink with zoom and stop growing at natural size', () => {
  for (const [k, scale] of [
    [0.5, 0.5],
    [1, 1],
    [4, 1],
  ]) {
    const { labels, boxes } = render(k)
    assert.deepEqual(
      labels.map(({ font }) => font),
      [
        `600 ${12 * scale}px sans-serif`,
        `400 ${12 * scale}px sans-serif`,
        `400 ${12 * scale}px sans-serif`,
        `${11 * scale}px monospace`,
      ],
    )
    assert.equal(labels[0].y, 60 * k + 4 * scale)
    assert.equal(labels[0].outline, 4 * scale)
    assert.deepEqual(boxes.slice(1), [
      { x: 150 * k - 39 * scale, y: 50 * k - 9 * scale, width: 78 * scale, height: 18 * scale },
    ])
  }
})

test('selected and hovered labels stay visible at distant zoom without changing their scale', () => {
  assert.deepEqual(
    render(0.25).labels.map(({ label, font }) => [label, font]),
    [
      ['a', '600 3px sans-serif'],
      ['b', '400 3px sans-serif'],
      ['relates to', '2.75px monospace'],
    ],
  )
})
