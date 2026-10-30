import assert from 'node:assert/strict'
import { actionState, waitFor, type CheckContext } from './helpers.ts'

export async function verifyPanel({ window, url, name, attempted }: CheckContext) {
  await window.loadURL(url)
  const code = `import {createElement,useEffect,useState} from 'react';
  function Browse(context){
    const [ready,setReady]=useState(false);
    useEffect(()=>{void(async()=>{
    const state=context.document.getState();
    const result={target:context.viewId,concepts:state.viewGraph.concepts.map(c=>c.id),dom:document.getElementById('root').ownerDocument===document,bridges:typeof require==='undefined'&&typeof process==='undefined'&&typeof window.nessoPlugins==='undefined'&&typeof window.nessoStorage==='undefined'};
    try{parent.document.body;result.host=false}catch{result.host=true}
    try{localStorage.setItem('probe','1');result.storage=false}catch{result.storage=true}
    try{await fetch('http://127.0.0.1:5191/plugin-probe');result.network=false}catch{result.network=true}
    try{result.worker=await new Promise(resolve=>{const worker=new Worker('data:text/javascript,postMessage(1)');worker.onmessage=()=>{worker.terminate();resolve(false)};worker.onerror=event=>{event.preventDefault();resolve(true)}})}catch{result.worker=true}
    await context.notifications.notify({tone:'info',title:{en:'Probe'},description:{en:JSON.stringify(result)}});
    setReady(true);
    })();return()=>{document.documentElement.dataset.cleaned='true'}},[]);
    return createElement('p',null,ready?'Plugin content':'Loading');
  }
  export const create=()=>[
    {id:'other',label:{en:'Other'},ui:(context)=>createElement('button',{onClick:()=>{void context.notifications.notify({tone:'info',title:{en:'Busy'}});while(true){}}},'Other UI')},
    {id:'browse',label:{en:'Browse'},ui:Browse},
    {id:'broken',label:{en:'Broken'},ui:()=>{throw new Error('Render failure')}},
  ];`
  const state = { ...actionState(), targetViewId: 'urn:target', locale: 'it', theme: { ...actionState().theme, background: '#ffffff' }, viewGraph: { concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] } }
  await window.webContents.executeJavaScript(`window.__openPanel=async(actionId)=>{
    window.__panel={ready:0,requests:[],pong:false,failed:false};
    const frame=document.createElement('iframe');frame.id='panel-probe';frame.sandbox='allow-scripts';frame.title='Plugin panel';frame.style='width:600px;height:400px';
    const loaded=new Promise(resolve=>frame.onload=resolve);frame.src=${JSON.stringify(`${new URL('plugin-runner/panel.html', url)}#probe`)};document.body.append(frame);await loaded;
    const channel=new MessageChannel();window.__panelPort=channel.port1;
    window.onmessage=event=>{if(event.source===frame.contentWindow&&event.data?.type==='plugin-closed')window.__panel.failed=true};
    channel.port1.onmessage=({data})=>{
      if(data.type==='panel-ready'){if(++window.__panel.ready===1)channel.port1.postMessage({type:'invoke',actionId,state:${JSON.stringify(state)}})}
      if(data.type==='request'){window.__panel.requests.push(data);channel.port1.postMessage({type:'response',id:data.id,ok:true,value:'notice'})}
      if(data.type==='pong')window.__panel.pong=true;
    };
    frame.contentWindow.postMessage({type:'bootstrap',token:'probe',entry:${JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}},'*',[channel.port2]);
  };window.__openPanel('browse')`)
  const evaluate = <T>(code: string) => window.webContents.executeJavaScript(code) as Promise<T>
  await waitFor(() => evaluate<number>('window.__panel.ready'), (ready) => ready === 2)
  await waitFor(() => evaluate<number>('window.__panel.requests.length'), (count) => count === 1)
  const result = await evaluate('JSON.parse(window.__panel.requests[0].params.description.en)')
  assert.deepEqual(result, { target: 'urn:target', concepts: ['urn:a'], dom: true, bridges: true, host: true, storage: true, network: true, worker: true })
  const content = window.webContents.mainFrame.framesInSubtree.find((frame) => frame.url === 'about:srcdoc')!
  assert.ok(content)
  await evaluate(`window.__panelPort.postMessage({type:'state',state:${JSON.stringify({ ...state, revision: 1, locale: 'en', theme: { ...state.theme, background: '#eeeeee' } })}});window.__panelPort.postMessage({type:'ping',id:1});`)
  await waitFor(() => evaluate<boolean>('window.__panel.pong'), Boolean)
  await waitFor(() => content.executeJavaScript(`document.getElementById('root').textContent==='Plugin content'`), Boolean)
  assert.deepEqual(await content.executeJavaScript(`({lang:document.documentElement.lang,background:document.documentElement.style.getPropertyValue('--background'),content:document.getElementById('root').textContent})`), { lang: 'en', background: '#eeeeee', content: 'Plugin content' })
  await evaluate(`window.__panelPort.postMessage({type:'close',reason:'Closed'})`)
  await waitFor(() => content.executeJavaScript(`document.documentElement.dataset.cleaned==='true' && document.getElementById('root').textContent===''`), Boolean)
  await evaluate(`window.__panelPort.close();document.querySelector('#panel-probe').remove();window.__openPanel('broken')`)
  await waitFor(() => evaluate<boolean>('window.__panel.failed'), Boolean)
  await evaluate(`window.__panelPort.close();document.querySelector('#panel-probe').remove();window.__openPanel('other')`)
  await waitFor(() => evaluate<number>('window.__panel.ready'), (ready) => ready === 2)
  const other = window.webContents.mainFrame.framesInSubtree.find((frame) => frame.url === 'about:srcdoc')!
  assert.equal(await other.executeJavaScript(`document.getElementById('root').textContent`), 'Other UI')
  await other.executeJavaScript(`setTimeout(()=>document.querySelector('#root button').click(),0)`)
  await waitFor(() => evaluate<number>('window.__panel.requests.length'), (count) => count === 1)
  await evaluate(`window.__panelPort.close();document.querySelector('#panel-probe').remove()`)
  assert.equal(await evaluate(`!!document.querySelector('#panel-probe')`), false)
  assert.equal(attempted.length, 0)
  console.log(`${name}: React UI selection, hooks, cleanup, render failure, sandbox, presentation updates and responsive host during busy content passed`)
}
