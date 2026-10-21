import assert from 'node:assert/strict'
import { baseState, waitFor, type CheckContext } from './helpers.ts'

export async function verifyDefinitions({ window, url, attempted }: CheckContext) {
  const state = baseState()
  const code = `export const create=async()=>{
    const result={};const target='http://127.0.0.1:5191/plugin-probe';
    for(const [name,run] of Object.entries({
      parentDOM:()=>parent.document.body,storage:()=>localStorage.length,
      fetch:()=>fetch(target),module:()=>import(target),
      worker:()=>new Promise((resolve,reject)=>{const worker=new Worker('data:text/javascript,postMessage(1)');worker.onmessage=resolve;worker.onerror=reject}),
      font:()=>new FontFace('probe','url('+target+')').load(),
      xhr:()=>new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET',target);xhr.onload=resolve;xhr.onerror=reject;xhr.send()}),
    })){try{await run();result[name]=false}catch{result[name]=true}}
    result.bridges=typeof window.nessoPersistence==='undefined'&&typeof window.nessoAi==='undefined'&&typeof window.nessoFiles==='undefined'&&typeof window.nessoPlugins==='undefined'&&typeof require==='undefined';
    const image=new Image();image.src=target;document.body.append(image);
    const link=document.createElement('link');link.rel='stylesheet';link.href=target;document.head.append(link);
    const form=document.createElement('form');form.action=target;document.body.append(form);form.submit();
    try{navigator.sendBeacon(target,'probe')}catch{}
    try{new WebSocket('ws://127.0.0.1:5191/plugin-probe')}catch{}
    result.popup=window.open(target)===null;
    try{top.location.href=target;result.topNavigation=false}catch{result.topNavigation=true}
    return {id:'probe',relationTypes:Object.entries(result).map(([name,value])=>({id:'urn:probe:'+name,label:name+':'+value})),defaultTypeId:'urn:probe:parentDOM'};
  }`
  const runner = new URL('plugin-runner/index.html', url).href
  await window.webContents.executeJavaScript(`(async()=>{
    window.__definition=null;window.__definitionClosed=false;
    const frame=document.createElement('iframe');frame.id='definition-probe';frame.sandbox='allow-scripts';frame.hidden=true;
    window.addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.data?.type==='plugin-closed'&&event.data.token==='probe')window.__definitionClosed=true});
    const loaded=new Promise(resolve=>frame.onload=resolve);frame.src=${JSON.stringify(`${runner}#probe`)};document.body.append(frame);await loaded;
    const channel=new MessageChannel();window.__definitionPort=channel.port1;channel.port1.onmessage=({data})=>{window.__definition=data};
    frame.contentWindow.postMessage({type:'bootstrap',mode:'definition',kind:'vocab',token:'probe',state:${JSON.stringify(state)},entry:${JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}},'*',[channel.port2]);
  })()`)
  const definition = await waitFor(async () => window.webContents.executeJavaScript('window.__definition') as Promise<{ type: string; value: { relationTypes: { label: string }[] } } | null>, (value) => !!value)
  assert.equal(definition!.type, 'contribution')
  assert.deepEqual(Object.fromEntries(definition!.value.relationTypes.map(({ label }) => { const [name, value] = label.split(':'); return [name, value === 'true'] })), { parentDOM: true, storage: true, fetch: true, module: true, worker: true, font: true, xhr: true, bridges: true, popup: true, topNavigation: true })
  const guard = window.webContents.mainFrame.frames.find((frame) => frame.url === `${runner}#probe`)!
  const child = guard.frames.find((frame) => frame.url === 'about:srcdoc')!
  await child.executeJavaScript(`document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(element=>element.remove());location.href=${JSON.stringify(`${runner}?plugin-probe=secret`)}`)
  await waitFor(async () => window.webContents.executeJavaScript('window.__definitionClosed') as Promise<boolean>, (value) => value)
  await window.webContents.executeJavaScript("window.__definitionPort.close();document.querySelector('#definition-probe').remove()")
  assert.equal(attempted.length, 0)
}

export async function verifyWorker({ window, url, name, attempted }: CheckContext) {
  const code = `export const create=({store,notifications,clipboard})=>{
    if(clipboard!==undefined||navigator.clipboard!==undefined)throw new Error('Unexpected clipboard access');return [{
    id:'probe',label:{en:'Probe'},supportsViews:false,
    run:async()=>{
      const id=await store.addConcept({x:12,y:34});
      const result={helper:/^urn:uuid:/.test(id),dom:typeof document==='undefined'&&typeof parent==='undefined',bridges:typeof require==='undefined'&&typeof window==='undefined'&&typeof process==='undefined'&&typeof self.nessoPlugins==='undefined',origin:location.origin};
      try{indexedDB.open('worker-probe');result.storage=false}catch{result.storage=true}
      const target='http://127.0.0.1:5191/plugin-probe';
      for(const [name,run] of Object.entries({
        fetch:()=>fetch(target),module:()=>import(target),
        xhr:()=>new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET',target);xhr.onload=resolve;xhr.onerror=reject;xhr.send()}),
        socket:()=>new Promise((resolve,reject)=>{const socket=new WebSocket('ws://127.0.0.1:5191/plugin-probe');socket.onopen=resolve;socket.onerror=reject}),
      })){try{await run();result[name]=false}catch{result[name]=true}}
      try{location.href=target;result.navigation=false}catch{result.navigation=true}
      await notifications.notify({tone:'info',title:{en:'Probe'},description:{en:JSON.stringify(result)}});
      await notifications.notify({tone:'info',title:{en:'Busy'}});
      while(true){}
    }
  }]}`
  await window.loadURL(`${new URL('plugin-runner/actions.html', url)}#probe`)
  window.webContents.debugger.attach()
  const workers = async () => {
    const { targetInfos } = await window.webContents.debugger.sendCommand('Target.getTargets')
    return targetInfos.filter((target: { type: string }) => target.type === 'worker').length as number
  }
  const before = await workers()
  const state = baseState()
  await window.webContents.executeJavaScript(`
    window.__probe=[];window.__complete=false;
    const channel=new MessageChannel();window.__port=channel.port1;
    channel.port1.onmessage=({data})=>{
      if(data.type==='contribution')channel.port1.postMessage({type:'invoke',actionId:'probe',invocation:{viewId:null}});
      if(data.type==='request'){
        window.__probe.push(data.params);
        channel.port1.postMessage({type:'response',id:data.id,ok:true,value:data.method==='store.applyOperations'?{revision:0,changed:true}:'notification'});
      }
      if(data.type==='complete')window.__complete=true;
    };
    window.postMessage({type:'bootstrap',token:'probe',state:${JSON.stringify(state)},entry:${JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}},'*',[channel.port2]);
  `)
  await waitFor(async () => window.webContents.executeJavaScript("window.__probe.some(value=>value.title?.en==='Busy')") as Promise<boolean>, (value) => value)
  assert.deepEqual(await window.webContents.executeJavaScript("JSON.parse(window.__probe.find(value=>value.title?.en==='Probe').description.en)"), { helper: true, dom: true, bridges: true, origin: 'null', storage: true, fetch: true, module: true, xhr: true, socket: true, navigation: true })
  const operations = await window.webContents.executeJavaScript("window.__probe.find(value=>value.operations).operations")
  assert.equal(operations.length, 1)
  assert.deepEqual(operations[0], { kind: 'concept.add', id: operations[0].id, position: { x: 12, y: 34 } })
  assert.match(operations[0].id, /^urn:uuid:/)
  assert.ok(await workers() > before)
  assert.equal(await window.webContents.executeJavaScript("window.__responsive=true;window.__responsive"), true)
  await window.webContents.executeJavaScript("window.__port.close();document.querySelector('iframe').src='about:blank';document.querySelector('iframe').remove()")
  await waitFor(workers, (value) => value === before)
  assert.equal(await window.webContents.executeJavaScript('window.__complete'), false)
  assert.equal(attempted.length, 0)
  console.log(`${name}: asynchronous helper in opaque action worker, denied storage/network/navigation, responsive host and terminated busy worker passed`)
}
