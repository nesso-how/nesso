import assert from 'node:assert/strict'
import { waitFor, type CheckContext } from './helpers.ts'

export async function verifyCompact({ window, url }: CheckContext) {
  const evaluate = <T>(script: string) => window.webContents.executeJavaScript(script) as Promise<T>
  const ready = (script: string) => waitFor(() => evaluate<boolean>(script), Boolean)
  const click = (selector: string) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const tap = async (selector: string) => {
    const point = await evaluate<{ x: number; y: number }>(`(()=>{
      const bounds=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    })()`)
    await window.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    })
    await window.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  }
  const tab = (label: string) =>
    evaluate(
      `[...document.querySelectorAll('.compact-tab')].find(tab=>tab.textContent.startsWith(${JSON.stringify(label)})).click()`,
    )
  const centered = () =>
    ready(`(()=>{
      const node=document.querySelector('#canvas .react-flow__node.selected')?.getBoundingClientRect();
      const sheet=document.querySelector('.nesso-sheet')?.getBoundingClientRect();
      const canvas=document.querySelector('#canvas .react-flow').getBoundingClientRect();
      return !!node && !!sheet && node.bottom<sheet.top && Math.abs((node.top+node.bottom)/2-(canvas.top+sheet.top)/2)<2;
    })()`)
  const fits = () =>
    evaluate<boolean>(
      `document.documentElement.scrollWidth<=innerWidth && document.querySelector('.compact-tab-bar').getBoundingClientRect().bottom<=innerHeight`,
    )

  window.setContentSize(390, 844)
  await window.loadURL(url)
  window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await ready(`document.querySelectorAll('.compact-intro .react-flow__node').length===4`)
  assert.equal(await evaluate(`document.querySelectorAll('.intro-navigation').length`), 0)
  await click('.compact-intro-footer button')
  await ready(`!!document.querySelector('#canvas .react-flow')`)
  assert.equal(await evaluate(`document.querySelectorAll('.nesso-sheet').length`), 0)
  assert.equal(await fits(), true)
  await evaluate(`document.fonts.ready.then(()=>true)`)
  await ready(`(()=>{
    const canvas=document.querySelector('#canvas .react-flow').getBoundingClientRect();
    const nodes=[...document.querySelectorAll('#canvas .react-flow__node')];
    return nodes.length===4 && nodes.every(node=>{
      const bounds=node.getBoundingClientRect();
      return bounds.width>0 && bounds.left>=canvas.left && bounds.right<=canvas.right && bounds.top>=canvas.top && bounds.bottom<=canvas.bottom;
    });
  })()`)
  const positions = await evaluate(
    `[...document.querySelectorAll('#canvas .react-flow__node')].map(node=>[node.dataset.id,node.style.transform])`,
  )
  await tap('[data-id="urn:nesso:example:coffee"]')
  await ready(`document.querySelector('.nesso-sheet-title')?.textContent==='Coffee'`)
  await centered()
  await evaluate(`document.querySelector('#canvas .react-flow__node.selected').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    document.querySelector('#canvas .react-flow').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`)
  assert.equal(await evaluate(`document.querySelectorAll('#canvas input').length`), 0)
  await click('.nesso-sheet li button')
  await ready(`document.querySelector('.nesso-sheet-title')?.textContent==='Energy'`)
  await centered()
  window.setContentSize(320, 568)
  await centered()
  assert.equal(await fits(), true)
  assert.equal(
    await evaluate(`document.querySelector('.nesso-sheet').scrollWidth<=innerWidth`),
    true,
  )
  window.setContentSize(568, 320)
  await centered()
  assert.equal(await fits(), true)
  window.setContentSize(320, 568)
  await centered()
  await evaluate(`Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async url=>{window.__shared=url}}})`)
  await click('.nesso-sheet-footer button')
  await ready(`window.__shared==='https://nesso.how'`)
  await click('.nesso-sheet button[aria-label="Close"]')
  await ready(`!document.querySelector('.nesso-sheet')`)
  await click('.compact-view-switcher')
  await ready(`!!document.querySelector('[role="menuitemradio"]')`)
  await evaluate(
    `[...document.querySelectorAll('[role="menuitemradio"]')].find(item=>item.textContent.startsWith('Rest')).click()`,
  )
  await ready(`document.querySelector('.compact-view-switcher')?.textContent==='Rest'`)
  await ready(`document.querySelectorAll('#canvas .react-flow__node').length===3`)
  await tab('Review')
  await ready(`document.querySelector('[data-plugin-panel]')?.getAttribute('aria-busy')==='false'`)
  let frame = window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame.url === 'about:srcdoc',
  )!
  assert.ok(frame)
  const reviewReady = (script: string) => waitFor(() => frame.executeJavaScript(script), Boolean)
  await reviewReady(`!!document.querySelector('.review-start button')`)
  await frame.executeJavaScript(`document.querySelector('.review-start button').click()`)
  await reviewReady(`!!document.querySelector('.review-response textarea')`)
  await frame.executeJavaScript(`document.querySelector('.review-response textarea').value='My explanation';
    document.querySelector('.review-reveal button').click()`)
  await reviewReady(`document.querySelectorAll('.review-ratings button').length===4`)
  assert.equal(
    await frame.executeJavaScript(`(()=>{
      const buttons=[...document.querySelectorAll('.review-ratings button')];
      return document.querySelector('textarea').value==='My explanation' && buttons.every(button=>{
        const bounds=button.getBoundingClientRect();return bounds.height>=44 && bounds.bottom<=innerHeight;
      });
    })()`),
    true,
  )
  window.setContentSize(568, 320)
  await reviewReady(`innerWidth===568 && document.querySelector('.review-study').clientHeight<200`)
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
  await reviewReady(`document.querySelector('.review-response textarea')?.value===''`)
  assert.equal(
    await frame.executeJavaScript(`document.querySelector('.review-study').scrollTop`),
    0,
  )
  window.setContentSize(320, 568)
  await tab('Notes')
  await ready(`document.querySelector('[data-plugin-panel]')?.getAttribute('aria-busy')==='false'`)
  frame = window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame.url === 'about:srcdoc',
  )!
  assert.ok(frame)
  await waitFor(
    () =>
      frame.executeJavaScript(`!!document.querySelector('.notes-editor [contenteditable="true"]')`),
    Boolean,
  )
  await tab('Graph')
  await ready(`!document.querySelector('[data-plugin-panel]')`)
  assert.equal(await fits(), true)
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('#canvas .react-flow__node')].map(node=>[node.dataset.id,node.style.transform])`,
    ),
    (positions as string[][]).filter(([id]) => id !== 'urn:nesso:example:energy'),
  )
  window.setContentSize(1280, 900)
  await ready(
    `!document.querySelector('.compact-tab-bar') && !!document.querySelector('[data-slot="sidebar-inner"]')`,
  )
  await click('[data-id="urn:nesso:example:coffee"]')
  window.setContentSize(390, 844)
  await ready(
    `!!document.querySelector('.compact-tab-bar') && !document.querySelector('.nesso-sheet')`,
  )
  assert.equal(await evaluate(`document.querySelectorAll('.react-flow__node.selected').length`), 0)
}
