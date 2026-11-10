import assert from 'node:assert/strict'
import { actionState, panelFrame, waitFor, type CheckContext } from './helpers.ts'

export async function verifyNotes({ window, url }: CheckContext) {
  await window.loadURL(url)
  const evaluate = <T>(code: string) => window.webContents.executeJavaScript(code) as Promise<T>
  const state = {
    ...actionState(),
    workspace: {
      activeViewId: null,
      savedViews: [{ id: 'urn:project', name: 'Project', pinned: false }],
    },
  }
  await evaluate(`window.__notesRecords=[];window.__notesRevision=0;
    window.__openNotes=async(viewId,reuse=false)=>{
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
          channel.port1.postMessage({type:'invoke',actionId:'notes',state:{...${JSON.stringify(state)},targetViewId:viewId}});
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
  const open = async (viewId: string | null, reuse = false) => {
    await evaluate(`window.__openNotes(${JSON.stringify(viewId)},${reuse})`)
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
      `window.__notesRecords.find(r=>r.scope?.kind==='view'&&r.scope.id==='urn:project')?.value.text`,
    )
  let frame = await open('urn:project')
  assert.deepEqual(
    await frame.executeJavaScript(
      `({title:document.querySelector('h1').textContent,buttons:document.querySelectorAll('button').length})`,
    ),
    {
      title: 'Project',
      buttons: 0,
    },
  )
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
  await frame.executeJavaScript(
    `document.querySelector('.cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:/Mac/.test(navigator.platform),ctrlKey:!/Mac/.test(navigator.platform),bubbles:true,cancelable:true}))`,
  )
  await waitFor(savedText, (value) => value === '')
  await frame.executeJavaScript(
    `document.querySelector('.cm-content').dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:/Mac/.test(navigator.platform),ctrlKey:!/Mac/.test(navigator.platform),shiftKey:true,bubbles:true,cancelable:true}));document.querySelector('.cm-content').blur()`,
  )
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
  await evaluate(
    `window.__notesRecords.push({key:'notes',value:{version:1,text:'Line\\n'.repeat(200)}});for(const record of window.__notesRecords)if(record.scope)record.value.text+='\\nLine'.repeat(200)`,
  )
  const scrollTop = () =>
    frame.executeJavaScript(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(document.querySelector('.notes-content').scrollTop))))`,
    ) as Promise<number>
  frame = await open(null, true)
  assert.equal(await scrollTop(), 0)
  await frame.executeJavaScript(
    `(()=>{const content=document.querySelector('.notes-content');content.scrollTop=content.scrollHeight/2})()`,
  )
  const scrolled = await scrollTop()
  assert.ok(scrolled > 0)
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
  await evaluate(`window.__notesFailure='save'`)
  await type('Unsaved draft')
  await waitFor(
    () => frame.executeJavaScript(`!!document.querySelector('[data-slot="banner"]')`),
    Boolean,
  )
  assert.deepEqual(
    await frame.executeJavaScript(
      `({warning:document.querySelector('.notes-page > [role="alert"]').dataset.tone,readonly:document.querySelector('.cm-content').getAttribute('aria-readonly'),draft:document.querySelector('.cm-content').textContent.includes('Unsaved draft')})`,
    ),
    { warning: 'warning', readonly: 'true', draft: true },
  )
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
