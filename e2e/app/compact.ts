import assert from 'node:assert/strict'
import { ipcMain } from 'electron'
import { connectFixtureStorage, panelFrame, waitFor, type CheckContext } from '../helpers.ts'

export async function verifyCompact({ window, url, name }: CheckContext) {
  if (name === 'desktop') {
    connectFixtureStorage()
    ipcMain.handle('plugins:list', () => ({
      value: { safeMode: false, packages: [], incompatible: [], issues: [] },
    }))
  }
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const ready = (script: string) => waitFor(() => evaluate<boolean>(script), Boolean)
  const click = (selector: string) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const centered = () =>
    ready(`(()=>{
      const node=document.querySelector('#canvas .react-flow__node.selected')?.getBoundingClientRect();
      const sheet=document.querySelector('.nesso-sheet')?.getBoundingClientRect();
      const canvas=document.querySelector('#canvas .react-flow').getBoundingClientRect();
      return !!node && !!sheet && node.bottom<sheet.top && Math.abs((node.top+node.bottom)/2-(canvas.top+sheet.top)/2)<2;
    })()`)

  window.setContentSize(390, 844)
  await window.loadURL(url)
  await ready(`!!document.querySelector('.compact-intro-footer button')`)
  await ready(`!document.querySelector('.splash')`)
  assert.equal(
    await evaluate(`!!document.querySelector('.compact-intro-footer p')`),
    name === 'static-web',
  )
  await click('.compact-intro-footer button')
  await ready(`(()=>{
    const canvas=document.querySelector('#canvas .react-flow')?.getBoundingClientRect();
    const nodes=[...document.querySelectorAll('#canvas .react-flow__node')].map(node=>node.getBoundingClientRect());
    return !!canvas && nodes.length>0 && nodes.every(node=>node.width>0 && node.left>=canvas.left && node.right<=canvas.right && node.top>=canvas.top && node.bottom<=canvas.bottom);
  })()`)
  assert.equal(await evaluate(`!!document.querySelector('.nesso-sheet')`), false)
  await click('[data-id="urn:nesso:example:coffee"]')
  await centered()
  assert.equal(
    await evaluate(`!!document.querySelector('.nesso-sheet-footer button')`),
    name === 'static-web',
  )
  await evaluate(
    `document.querySelector('.react-flow__edge-interaction').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
  )
  assert.equal(await evaluate(`!!document.querySelector('.react-flow__edge.selected')`), false)
  assert.equal(await evaluate(`!!document.querySelector('.nesso-sheet')`), true)
  await click('.nesso-sheet li button')
  await ready(`document.querySelector('.nesso-sheet-title')?.textContent==='Energy'`)
  await centered()

  window.setContentSize(1280, 900)
  await ready(`!document.querySelector('.compact-tab-bar')`)
  await click('[data-id="urn:nesso:example:coffee"]')
  window.setContentSize(568, 320)
  await ready(
    `!!document.querySelector('.compact-tab-bar') && !document.querySelector('.nesso-sheet')`,
  )
  assert.equal(await evaluate(`!!document.querySelector('.react-flow__node.selected')`), false)

  const openReview = async () => {
    await evaluate(
      `[...document.querySelectorAll('.compact-tab')].find(tab=>tab.textContent.startsWith('Review')).click()`,
    )
    await ready(
      `document.querySelector('[data-plugin-panel]')?.getAttribute('aria-busy')==='false'`,
    )
    const frame = await panelFrame(window, `!!document.querySelector('.review-start button')`)
    await frame.executeJavaScript(`document.querySelector('.review-start button').click()`)
    return frame
  }
  let frame = await openReview()
  const reviewReady = (script: string) => waitFor(() => frame.executeJavaScript(script), Boolean)
  await reviewReady(`!!document.querySelector('.review-reveal button')`)
  window.setContentSize(1000, 900)
  await ready(`!document.querySelector('.compact-tab-bar')`)
  await reviewReady(
    `innerWidth<768 && getComputedStyle(document.querySelector('.review-reveal kbd')).display!=='none'`,
  )
  assert.equal(
    await frame.executeJavaScript(
      `getComputedStyle(document.documentElement).getPropertyValue('--nesso-reading-font-size').trim()`,
    ),
    '13px',
  )
  window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  window.setContentSize(568, 320)
  await ready(`!!document.querySelector('.compact-tab-bar')`)
  await click('.compact-tab-list [role="tab"]')
  await ready(`!document.querySelector('[data-plugin-panel]')`)
  await waitFor(
    () => frame.executeJavaScript(`document.getElementById('root').textContent===''`),
    Boolean,
  )
  const retained = frame
  frame = await openReview()
  assert.equal(frame, retained)
  const { targetInfos } = await window.webContents.debugger.sendCommand('Target.getTargets')
  const panel = targetInfos.find((target: { type: string }) => target.type === 'iframe')
  if (panel) {
    const { sessionId } = await window.webContents.debugger.sendCommand('Target.attachToTarget', {
      targetId: panel.targetId,
      flatten: true,
    })
    await window.webContents.debugger.sendCommand(
      'Emulation.setTouchEmulationEnabled',
      { enabled: true, maxTouchPoints: 5 },
      sessionId,
    )
  }
  await reviewReady(
    `matchMedia('(pointer: coarse)').matches && getComputedStyle(document.querySelector('.review-reveal kbd')).display==='none'`,
  )
  await frame.executeJavaScript(`document.querySelector('.review-reveal button').click()`)
  await reviewReady(`!!document.querySelector('.review-reference')`)
  assert.equal(
    await frame.executeJavaScript(`(()=>{
      document.querySelector('.review-reference').textContent='Long reference '.repeat(1000);
      const study=document.querySelector('.review-study');
      study.scrollTop=study.scrollHeight;
      return study.scrollTop>0;
    })()`),
    true,
  )
  await frame.executeJavaScript(
    `document.querySelector('.review-ratings button:last-child').click()`,
  )
  await reviewReady(`!!document.querySelector('.review-reading:not(.review-exit) .review-prompt')`)
  assert.equal(
    await frame.executeJavaScript(`document.querySelector('.review-study').scrollTop`),
    0,
  )
}
