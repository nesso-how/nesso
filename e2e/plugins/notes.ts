import assert from 'node:assert/strict'
import { actionState, panelFrame, waitFor, type CheckContext } from '../helpers.ts'

export async function verifyNotes({ window, url }: CheckContext) {
  await window.loadURL(url)
  const evaluate = <T>(code: string) => window.webContents.executeJavaScript(code) as Promise<T>
  const state = {
    ...actionState(),
    workspace: {
      activeMapId: null,
      maps: [{ id: 'urn:project', name: 'Project', pinned: false }],
    },
  }
  await evaluate(`window.__notesRecords=[];window.__notesRevision=0;
    window.__openNotes=async(mapId,reuse=false)=>{
      window.__notesReady=0;
      const response=await fetch(${JSON.stringify(new URL('preinstalled/notes/index.js', url).href)});
      const bytes=new Uint8Array(await response.arrayBuffer());
      const entry='data:text/javascript;base64,'+btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
       const frame=reuse?document.querySelector('#notes-probe'):document.createElement('iframe');
       if(!reuse){frame.id='notes-probe';frame.sandbox='allow-scripts';frame.style='width:700px;height:600px';
      const loaded=new Promise(resolve=>frame.onload=resolve);
      frame.src=${JSON.stringify(`${new URL('plugin-runner/panel.html', url)}#notes`)};
       document.body.append(frame);await loaded;
       await new Promise(resolve=>{window.onmessage=event=>{if(event.source===frame.contentWindow&&event.data?.type==='plugin-ready'&&event.data.guard==='notes')resolve()};frame.contentWindow.postMessage({type:'prepare',guard:'notes',token:'notes',entry},'*')});}
      const channel=new MessageChannel();window.__notesPort=channel.port1;
      channel.port1.onmessage=({data})=>{
        if(data.type==='panel-ready'&&++window.__notesReady===1)
          channel.port1.postMessage({type:'invoke',actionId:'notes',state:{...${JSON.stringify(state)},targetMapId:mapId}});
        if(data.type!=='request')return;
        if((window.__notesFailure==='save'&&data.method==='storage.set')||
          (window.__notesFailure==='restore'&&data.method==='storage.list')){
          channel.port1.postMessage({type:'response',id:data.id,ok:false,error:{code:'failed',issues:[{path:'storage',message:'Storage unavailable'}]}});
          return;
        }
        let value;
        if(data.method==='storage.list')value={revision:window.__notesRevision,records:window.__notesRecords};
        else if(data.method==='storage.set'){
          const {revision,...record}=data.params;
          if(revision!==window.__notesRevision)throw new Error('Overlapping note writes');
          const index=window.__notesRecords.findIndex(r=>r.key===record.key&&JSON.stringify(r.scope)===JSON.stringify(record.scope));
          if(index===-1)window.__notesRecords.push(record);else window.__notesRecords[index]=record;
          value={revision:++window.__notesRevision,changed:true};
        }else throw new Error('Unexpected notes request: '+data.method);
        channel.port1.postMessage({type:'response',id:data.id,ok:true,value});
      };
       frame.contentWindow.postMessage({type:'bootstrap',guard:'notes',token:'notes'},'*',[channel.port2]);
    };undefined`)
  const open = async (mapId: string | null, reuse = false) => {
    await evaluate(`window.__openNotes(${JSON.stringify(mapId)},${reuse})`)
    await waitFor(
      () => evaluate<number>('window.__notesReady'),
      (ready) => ready === 2,
    )
    return panelFrame(
      window,
      `!!document.querySelector('.notes-editor .cm-content, [data-slot="banner"]')`,
    )
  }
  const close = async () => {
    await evaluate(`window.__notesPort.postMessage({type:'close',reason:'Closed'})`)
    await evaluate(`window.__notesPort.close();document.querySelector('#notes-probe').remove()`)
  }
  const savedText = () =>
    evaluate<string | undefined>(
      `window.__notesRecords.find(r=>r.scope?.kind==='map'&&r.scope.id==='urn:project')?.value.text`,
    )
  let frame = await open('urn:project')
  assert.equal(await frame.executeJavaScript(`document.querySelector('h1').textContent`), 'Project')
  const key = (key: string, modifiers = {}) =>
    frame.executeJavaScript(
      `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},...${JSON.stringify(modifiers)},bubbles:true,cancelable:true}))`,
    )
  const mod = process.platform === 'darwin' ? { metaKey: true } : { ctrlKey: true }
  const text = '**Project ideas**\n- First idea'
  const type = async (text: string) => {
    if (process.platform === 'linux') {
      window.focus()
      window.webContents.focus()
      await waitFor(
        () =>
          frame.executeJavaScript(
            `document.querySelector('.cm-content').focus();document.hasFocus() && document.activeElement===document.querySelector('.cm-content')`,
          ),
        Boolean,
      )
    }
    assert.equal(
      await frame.executeJavaScript(
        `document.querySelector('.cm-content').focus();document.execCommand('insertText',false,${JSON.stringify(text)})`,
        true,
      ),
      true,
    )
  }
  await type(text)
  await waitFor(savedText, (value) => value === text)
  await key('z', mod)
  await waitFor(savedText, (value) => value === '')
  await key('z', { ...mod, shiftKey: true })
  await frame.executeJavaScript(`document.querySelector('.cm-content').blur()`)
  await waitFor(savedText, (value) => value === text)
  assert.equal(
    await frame.executeJavaScript(
      `Number(getComputedStyle(document.querySelector('.nesso-markdown-bold')).fontWeight)>=600`,
    ),
    true,
  )
  await frame.executeJavaScript(`window.__retainedDocument=document`)
  frame = await open(null, true)
  assert.equal(
    await frame.executeJavaScript(
      `window.__retainedDocument===document && !document.querySelector('.cm-content').textContent.includes('Project ideas')`,
    ),
    true,
  )
  frame = await open('urn:project', true)
  assert.equal(
    await frame.executeJavaScript(
      `window.__retainedDocument===document && document.querySelector('.cm-content').textContent.includes('Project ideas')`,
    ),
    true,
  )
  const wrappedLine = 'x'.repeat(120)
  await evaluate(
    `window.__notesRecords.push({key:'notes',value:{version:1,text:${JSON.stringify(`Line\n${wrappedLine}\n${'Line\n'.repeat(200)}`)}}});for(const record of window.__notesRecords)if(record.scope)record.value.text+='\\nLine'.repeat(200)+'\\nIDEA'`,
  )
  const scroller = `document.querySelector('.notes-editor .cm-scroller')`
  const scrollTop = () =>
    frame.executeJavaScript(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(${scroller}.scrollTop))))`,
    ) as Promise<number>
  frame = await open(null, true)
  assert.equal(await scrollTop(), 0)
  const bullet = `document.querySelector('button[aria-label="Bulleted list"]')`
  const bulletShortcut = process.platform === 'darwin' ? '⌘⇧8' : 'Ctrl+Shift+8'
  assert.equal(
    await frame.executeJavaScript(`${bullet}.title`),
    `Bulleted list (${bulletShortcut})`,
  )
  await frame.executeJavaScript(`document.querySelector('.cm-content').focus()`)
  await key('End', { shiftKey: true })
  assert.equal(
    await frame.executeJavaScript(
      `!${bullet}.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))`,
    ),
    true,
  )
  await frame.executeJavaScript(`${bullet}.click()`)
  await waitFor(
    () =>
      frame.executeJavaScript(`(${bullet}.getAttribute('aria-pressed') === 'true' &&
      document.activeElement.matches('.cm-content') && document.getSelection().toString() === 'Line')`),
    Boolean,
  )
  await key('*', { ...mod, keyCode: 56, shiftKey: true })
  await waitFor(
    () =>
      frame.executeJavaScript(`${bullet}.getAttribute('aria-pressed') === 'false' &&
      document.getSelection().toString() === 'Line'`),
    Boolean,
  )
  await evaluate(`document.querySelector('#notes-probe').style.width = '240px'`)
  await waitFor(
    () => frame.executeJavaScript('innerWidth'),
    (width) => width === 240,
  )
  const textClearance = (await frame.executeJavaScript(`(() => {
    const scroller = ${scroller}
    const line = [...scroller.querySelectorAll('.cm-line')].find(line => line.textContent === ${JSON.stringify(wrappedLine)})
    const range = document.createRange()
    range.selectNodeContents(line)
    const rightmostText = Math.max(...Array.from(range.getClientRects(), rect => rect.right))
    return scroller.getBoundingClientRect().left + scroller.clientWidth - rightmostText
  })()`)) as number
  assert.ok(textClearance >= 11, `Wrapped text is only ${textClearance}px from the scrollbar edge`)
  const findButton = `document.querySelector('button[aria-label="Find in notes"]')`
  const { scrollTop: scrolled, ...layout } = (await frame.executeJavaScript(`(async () => {
    const header = [document.querySelector('#notes-title'), document.querySelector('[aria-label="Note formatting"]'), ${findButton}]
    const [title, toolbar, search] = header.map(element => element.getBoundingClientRect())
    const scroller = ${scroller}
    const text = scroller.getBoundingClientRect()
    const panel = document.querySelector('.notes-page').getBoundingClientRect()
    scroller.scrollTop = scroller.scrollHeight / 2
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return {
      scrollTop: scroller.scrollTop,
      headerFixed: [title, toolbar, search].every((box, index) => box.top === header[index].getBoundingClientRect().top),
      controlsAboveText: title.bottom <= toolbar.top && search.left >= toolbar.right &&
        Math.max(toolbar.bottom, search.bottom) <= text.top,
      scrollerAtEdge: Math.abs(text.bottom - panel.bottom) < 1,
    }
  })()`)) as { scrollTop: number; [key: string]: unknown }
  assert.ok(scrolled > 0)
  assert.deepEqual(layout, { headerFixed: true, controlsAboveText: true, scrollerAtEdge: true })
  await evaluate(
    `document.querySelector('#notes-probe').hidden=true;window.__notesPort.postMessage({type:'close',reason:'Closed'});new Promise(resolve=>setTimeout(resolve,200))`,
  )
  await evaluate(`document.querySelector('#notes-probe').hidden=false`)
  frame = await open('urn:project', true)
  assert.equal(await scrollTop(), 0)
  frame = await open(null, true)
  assert.equal(await scrollTop(), scrolled)
  await close()
  frame = await open('urn:project')
  assert.equal(
    await frame.executeJavaScript(
      `document.querySelector('.cm-content').textContent.includes('Project ideas')`,
    ),
    true,
  )
  const count = (expected: string) =>
    waitFor(
      () =>
        frame.executeJavaScript(
          `document.querySelector('[role="search"] [role="status"]')?.textContent`,
        ),
      (value) => value === expected,
    )
  await frame.executeJavaScript(`${findButton}.click()`)
  await waitFor(
    () =>
      frame.executeJavaScript(`(${findButton}.getAttribute('aria-expanded') === 'true' &&
        document.activeElement.matches('[role="search"] input'))`),
    Boolean,
  )
  assert.equal(
    await frame.executeJavaScript(`document.execCommand('insertText',false,'idea')`, true),
    true,
  )
  await count('1/3')
  await key('Enter', { shiftKey: true })
  await count('3/3')
  assert.ok((await scrollTop()) > 0)
  assert.equal(
    await frame.executeJavaScript(`(() => {
      const bar = document.querySelector('[role="search"]')
      const panel = document.querySelector('.notes-page')
      const text = ${scroller}.getBoundingClientRect()
      const match = document.querySelector('.notes-match-current').getBoundingClientRect()
      return bar.getBoundingClientRect().bottom === panel.getBoundingClientRect().bottom &&
        match.top >= text.top && match.bottom <= text.bottom &&
        Math.abs(text.bottom - bar.getBoundingClientRect().top) < 1
    })()`),
    true,
  )
  await key('Enter')
  await count('1/3')
  await key('Escape')
  await waitFor(
    () =>
      frame.executeJavaScript(
        `document.activeElement.matches('.cm-content') && !document.querySelector('[role="search"]')`,
      ),
    Boolean,
  )
  await key('f', mod)
  await waitFor(
    () => frame.executeJavaScript(`document.activeElement.matches('[role="search"] input')`),
    Boolean,
  )
  await key('Escape')
  await evaluate(`window.__notesFailure='save'`)
  await type('Unsaved draft')
  await waitFor(
    () => frame.executeJavaScript(`!!document.querySelector('[data-slot="banner"]')`),
    Boolean,
  )
  assert.deepEqual(
    await frame.executeJavaScript(
      `({warning:document.querySelector('.notes-page > [role="alert"]').dataset.tone,readonly:document.querySelector('.cm-content').getAttribute('aria-readonly'),draft:document.querySelector('.cm-content').textContent.includes('Unsaved draft'),toolbar:[...document.querySelectorAll('[aria-label="Note formatting"] button')].map(button=>button.disabled).join(),tabIndex:document.querySelector('.cm-content').tabIndex})`,
    ),
    {
      warning: 'warning',
      readonly: 'true',
      draft: true,
      toolbar: Array(6).fill(true).join(),
      tabIndex: 0,
    },
  )
  await frame.executeJavaScript(`${findButton}.click()`)
  await waitFor(
    () => frame.executeJavaScript(`document.activeElement.matches('[role="search"] input')`),
    Boolean,
  )
  await frame.executeJavaScript(`document.execCommand('insertText',false,'Unsaved draft')`, true)
  await count('1/1')
  await close()
  await evaluate(`window.__notesFailure='restore'`)
  frame = await open('urn:project')
  assert.deepEqual(
    await frame.executeJavaScript(
      `({title:document.querySelector('h1').textContent,editor:!!document.querySelector('.cm-content'),reload:document.querySelector('.notes-page > [role="alert"] button').textContent})`,
    ),
    { title: 'Project', editor: false, reload: 'Reload notes' },
  )
  await evaluate(`window.__notesFailure=undefined`)
  await frame.executeJavaScript(`document.querySelector('[role="alert"] button').click()`)
  await waitFor(() => frame.executeJavaScript(`!!document.querySelector('.cm-content')`), Boolean)
  assert.equal(await frame.executeJavaScript(`!!document.querySelector('[role="alert"]')`), false)
  await close()
}
