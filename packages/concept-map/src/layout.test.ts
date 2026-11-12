import assert from 'node:assert/strict'
import test from 'node:test'
import { arrange, type LayoutBox } from './layout.ts'

const box = (
  id: string,
  x: number,
  y: number,
): LayoutBox & { position: { x: number; y: number } } => ({
  id,
  width: 100,
  height: 44,
  position: { x, y },
})

const overlaps = (a: LayoutBox, b: LayoutBox) =>
  Math.abs(a.position!.x - b.position!.x) < 100 && Math.abs(a.position!.y - b.position!.y) < 44

test('arrange places new nodes in the largest free space around their anchor', () => {
  const fixed = [box('a', 0, 0), box('left', -200, 0), box('up', 0, -150), box('down', 0, 150)]
  const free = [
    { id: 'x', width: 100, height: 44 },
    { id: 'y', width: 100, height: 44 },
  ]
  const links = free.map(({ id }) => ({ source: 'a', target: id }))
  const positions = arrange({ fixed, free, links })
  assert.deepEqual([...positions.keys()], ['x', 'y'])
  assert.deepEqual(arrange({ fixed, free, links }), positions)
  const placed = [...positions].map(([id, position]) => ({ id, width: 100, height: 44, position }))
  for (const node of placed) {
    assert.ok(node.position.x > 50)
    for (const other of [...fixed, ...placed]) if (other !== node) assert.ok(!overlaps(node, other))
  }
})

test('arrange keeps new nodes off the anchor relations to distant concepts', () => {
  const fixed = [box('a', 0, 0), box('far', 600, 0)]
  const free = [{ id: 'x', width: 100, height: 44 }]
  const links = [
    { source: 'a', target: 'far' },
    { source: 'a', target: 'x' },
  ]
  assert.ok(arrange({ fixed, free, links }).get('x')!.x + 100 <= -130)
  const bounds = { x: -60, y: -400, width: 760, height: 800 }
  const inside = arrange({ fixed, free, links, bounds }).get('x')!
  assert.ok(inside.x >= bounds.x && Math.abs(inside.y) >= 44 + 130)
})

test('arrange separates overlapping free nodes without moving fixed ones', () => {
  const fixed = [box('a', 0, 0)]
  const free = [box('x', 10, 0), box('y', 12, 4)]
  const positions = arrange({ fixed, free, links: [{ source: 'x', target: 'y' }] })
  const placed = [...positions].map(([id, position]) => ({ id, width: 100, height: 44, position }))
  assert.ok(!overlaps(placed[0], placed[1]))
  for (const node of placed) assert.ok(!overlaps(node, fixed[0]))
})
