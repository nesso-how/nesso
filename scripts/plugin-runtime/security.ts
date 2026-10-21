import assert from 'node:assert/strict'
import { baseState, waitFor, type CheckContext } from './helpers.ts'

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
