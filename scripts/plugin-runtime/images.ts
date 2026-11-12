import assert from 'node:assert/strict'
import { ipcMain, nativeImage } from 'electron'
import type { FileSaveOptions } from '@nesso-how/plugin/runtime'
import { imageBounds } from '../../packages/concept-map/src/image-bounds.ts'
import { openFixtureWorkspace, waitFor, type CheckContext } from './helpers.ts'

export async function verifyImages(context: CheckContext) {
  context.window.setSize(1280, 900)
  const scale = 4
  let written: FileSaveOptions | undefined
  ipcMain.handle('plugins:list', () => ({ value: { safeMode: false, packages: [], issues: [] } }))
  ipcMain.handle('files:save', (_event, _id: string, options: FileSaveOptions) => {
    written = options
    return { saved: true }
  })
  ipcMain.on('files:cancel', () => {})
  const { evaluate } = await openFixtureWorkspace(context, context.name === 'desktop')
  if (context.name === 'static-web')
    await evaluate(
      `window.showSaveFilePicker=async({suggestedName})=>({createWritable:async()=>({write:async(bytes)=>{window.__imageFile={name:suggestedName,mediaType:'image/png',base64:btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''))}},close:async()=>{},abort:async()=>{}})});void 0`,
    )
  await waitFor(
    () => evaluate<boolean>(`!!document.querySelector('#canvas .react-flow__edge-path')`),
    Boolean,
  )
  const before = await evaluate(
    `({transform:document.querySelector('#canvas .react-flow__viewport').style.transform,selected:document.querySelectorAll('#canvas .selected').length})`,
  )
  const geometry = await evaluate<{
    rects: { x: number; y: number; width: number; height: number }[]
    edges: { x: number; y: number }[][]
  }>(`(() => {
    const viewport = document.querySelector('#canvas .react-flow__viewport')
    const origin = viewport.getBoundingClientRect()
    const zoom = new DOMMatrix(getComputedStyle(viewport).transform).a
    return {
      rects: [...viewport.querySelectorAll('.react-flow__node, .react-flow__edge-path, .react-flow__edge-textwrapper')].map(node => {
        const rect = node.getBoundingClientRect()
        return { x: (rect.left - origin.left) / zoom, y: (rect.top - origin.top) / zoom, width: rect.width / zoom, height: rect.height / zoom }
      }),
      edges: [...viewport.querySelectorAll('.react-flow__edge-path')].map(path =>
        [0.2, 0.35, 0.65, 0.8].map(fraction => {
          const point = path.getPointAtLength(path.getTotalLength() * fraction)
          return { x: point.x, y: point.y }
        })),
    }
  })()`)
  assert.ok(geometry.edges.length > 0, 'The export fixture must contain relations')
  if (context.name === 'desktop') context.window.webContents.setZoomLevel(1)
  const trigger = `#canvas header button[aria-haspopup="menu"]:not(.canvas-tabs-more):not([disabled])`
  await waitFor(
    () => evaluate<boolean>(`!!document.querySelector(${JSON.stringify(trigger)})`),
    Boolean,
  )
  await evaluate(`document.querySelector(${JSON.stringify(trigger)}).click()`)
  await waitFor(
    () =>
      evaluate<boolean>(
        `[...document.querySelectorAll('[role="menuitem"]')].some(item=>item.textContent.trim()==='Export PNG')`,
      ),
    Boolean,
  )
  await evaluate(
    `[...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.trim()==='Export PNG').click()`,
  )
  const file = await waitFor(
    async () =>
      context.name === 'desktop'
        ? written
        : await evaluate<FileSaveOptions | undefined>('window.__imageFile'),
    Boolean,
  )
  assert.ok(file && 'base64' in file)
  assert.match(file.name, /\.png$/)
  assert.equal(file.mediaType, 'image/png')
  const bytes = Buffer.from(file.base64, 'base64')
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  const image = nativeImage.createFromBuffer(bytes)
  const { width, height } = image.getSize()
  assert.ok(!image.isEmpty(), 'The saved file must be a decodable PNG')
  const bitmap = image.toBitmap()
  const bounds = imageBounds(geometry.rects, scale)
  const background = bitmap.subarray(0, 4)
  for (const [index, edge] of geometry.edges.entries()) {
    const visible = edge.filter((point) => {
      const x = Math.round((point.x - bounds.x) * scale)
      const y = Math.round((point.y - bounds.y) * scale)
      assert.ok(x >= 2 && x < width - 2 && y >= 2 && y < height - 2)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const offset = ((y + dy) * width + x + dx) * 4
          if (!bitmap.subarray(offset, offset + 4).equals(background)) return true
        }
      return false
    })
    assert.ok(visible.length >= 3, `Relation ${index} must appear in the PNG pixels`)
  }
  assert.deepEqual(
    await evaluate(
      `({transform:document.querySelector('#canvas .react-flow__viewport').style.transform,selected:document.querySelectorAll('#canvas .selected').length})`,
    ),
    before,
  )
  await waitFor(() => evaluate<boolean>(`!document.querySelector('.graph-image-export')`), Boolean)
}
