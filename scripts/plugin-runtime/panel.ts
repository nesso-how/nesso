import assert from 'node:assert/strict'
import { actionState, waitFor, type CheckContext } from './helpers.ts'

export async function verifyPanel({ window, url, name, attempted }: CheckContext) {
  await window.loadURL(url)
  const code = `import React,{createElement,useEffect,useState} from 'react';
  import * as ReactNamespace from 'react';
  import ReactDOM,{flushSync} from 'react-dom';
  import ReactDOMClient,{createRoot} from 'react-dom/client';
  import {jsx} from 'react/jsx-runtime';
  import 'react/jsx-dev-runtime';
  export {useState} from 'react';
  const moduleIdentity={};
  function Browse(context){
    const [ready,setReady]=useState(false);
    useEffect(()=>{(window.__contexts??=[]).push(context);window.__moduleIdentity=moduleIdentity;void(async()=>{
    const dynamic=await import('react');
    if(React.createElement!==createElement||ReactNamespace.useState!==useState||dynamic.useState!==useState||ReactDOM.flushSync!==flushSync||ReactDOMClient.createRoot!==createRoot||typeof jsx!=='function')throw new Error('React module identity changed');
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
    {id:'browse',label:{en:'Browse'},ui:Browse},
    {id:'broken',label:{en:'Broken'},ui:()=>{throw new Error('Render failure')}},
  ];`
  const state = {
    ...actionState(),
    targetViewId: 'urn:target',
    locale: 'it',
    theme: { ...actionState().theme, background: '#ffffff' },
    viewGraph: {
      concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }],
      relations: [],
      relationTypes: [],
    },
  }
  await window.webContents
    .executeJavaScript(`window.__openPanel=async(actionId,reuse=false,initial=${JSON.stringify(state)})=>{
    window.__panel={ready:0,requests:[],pong:false,failed:false};
    const frame=reuse?document.querySelector('#panel-probe'):document.createElement('iframe');
    if(!reuse){frame.id='panel-probe';frame.sandbox='allow-scripts';frame.title='Plugin panel';frame.style='width:600px;height:400px';
    const loaded=new Promise(resolve=>frame.onload=resolve);frame.src=${JSON.stringify(`${new URL('plugin-runner/panel.html', url)}#probe`)};document.body.append(frame);await loaded;}
    if(!reuse)await new Promise(resolve=>{window.onmessage=event=>{if(event.source===frame.contentWindow&&event.data?.type==='plugin-ready'&&event.data.guard==='probe')resolve()};frame.contentWindow.postMessage({type:'prepare',guard:'probe',token:'probe',entry:${JSON.stringify(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}},'*')});
    const channel=new MessageChannel();window.__panelPort=channel.port1;
    window.onmessage=event=>{if(event.source===frame.contentWindow&&event.data?.type==='plugin-closed'&&event.data.guard==='probe')window.__panel.failed=true};
    channel.port1.onmessage=({data})=>{
      if(data.type==='panel-ready'){if(++window.__panel.ready===1)channel.port1.postMessage({type:'invoke',actionId,state:initial})}
      if(data.type==='request'){window.__panel.requests.push(data);if(data.params.title?.en!=='Deferred')channel.port1.postMessage({type:'response',id:data.id,ok:true,value:'notice'})}
      if(data.type==='pong')window.__panel.pong=true;
    };
    frame.contentWindow.postMessage({type:'bootstrap',guard:'probe',token:'probe'},'*',[channel.port2]);
  };window.__openPanel('browse')`)
  const evaluate = <T>(code: string) => window.webContents.executeJavaScript(code) as Promise<T>
  await waitFor(
    () => evaluate<number>('window.__panel.ready'),
    (ready) => ready === 2,
  )
  await waitFor(
    () => evaluate<number>('window.__panel.requests.length'),
    (count) => count === 1,
  )
  const result = await evaluate('JSON.parse(window.__panel.requests[0].params.description.en)')
  assert.deepEqual(result, {
    target: 'urn:target',
    concepts: ['urn:a'],
    dom: true,
    bridges: true,
    host: true,
    storage: true,
    network: true,
    worker: true,
  })
  const content = window.webContents.mainFrame.framesInSubtree.find(
    (frame) => frame?.url === 'about:srcdoc',
  )!
  assert.ok(content)
  const shell = content.parent!
  await shell.executeJavaScript(`window.__retainedShell=document`)
  await evaluate(
    `window.__panelPort.postMessage({type:'state',state:${JSON.stringify({ ...state, revision: 1, locale: 'en', theme: { ...state.theme, background: '#eeeeee' } })}});window.__panelPort.postMessage({type:'ping',id:1});`,
  )
  await waitFor(() => evaluate<boolean>('window.__panel.pong'), Boolean)
  await waitFor(
    () =>
      content.executeJavaScript(`document.getElementById('root').textContent==='Plugin content'`),
    Boolean,
  )
  assert.deepEqual(
    await content.executeJavaScript(
      `({lang:document.documentElement.lang,background:document.documentElement.style.getPropertyValue('--background'),content:document.getElementById('root').textContent})`,
    ),
    { lang: 'en', background: '#eeeeee', content: 'Plugin content' },
  )
  await content.executeJavaScript(
    `window.__initialDocument=document;window.__initialModule=window.__moduleIdentity;window.__pending=window.__contexts[0].notifications.notify({tone:'info',title:{en:'Deferred'}}).then(()=> 'completed',error=>error.code);undefined`,
  )
  await waitFor(
    () => evaluate<number>('window.__panel.requests.length'),
    (count) => count === 2,
  )
  await evaluate(
    `window.__openPanel('browse',true,${JSON.stringify({ ...state, contextId: 'next-view', targetViewId: null })})`,
  )
  await waitFor(
    () =>
      content.executeJavaScript(
        `window.__contexts.length===2 && document.getElementById('root').textContent==='Plugin content'`,
      ),
    Boolean,
  )
  assert.deepEqual(
    await content.executeJavaScript(
      `(async()=>({document:document===window.__initialDocument,module:window.__moduleIdentity===window.__initialModule,aborted:window.__contexts[0].signal.aborted,current:window.__contexts[1].signal.aborted,target:window.__contexts[1].viewId,context:window.__contexts[1].document.getState().contextId,pending:await window.__pending,stale:await window.__contexts[0].notifications.notify({tone:'info',title:{en:'Stale'}}).then(()=> 'completed',error=>error.code),cleaned:document.documentElement.dataset.cleaned}))()`,
    ),
    {
      document: true,
      module: true,
      aborted: true,
      current: false,
      target: null,
      context: 'next-view',
      pending: 'closed',
      stale: 'closed',
      cleaned: 'true',
    },
  )
  assert.equal(await evaluate('window.__panel.requests.length'), 1)
  await evaluate(`window.__panelPort.postMessage({type:'close',reason:'Closed'})`)
  await waitFor(
    () =>
      content.executeJavaScript(
        `document.documentElement.dataset.cleaned==='true' && document.getElementById('root').textContent===''`,
      ),
    Boolean,
  )
  await evaluate(`window.__panelPort.close();window.__openPanel('browse',true)`)
  await waitFor(
    () =>
      content.executeJavaScript(
        `window.__contexts.length===3 && document.getElementById('root').textContent==='Plugin content'`,
      ),
    Boolean,
  )
  assert.equal(
    await content.executeJavaScript(
      `window.__moduleIdentity===window.__initialModule && window.__contexts[1].signal.aborted`,
    ),
    true,
  )
  await evaluate(`window.__panelPort.close();window.__openPanel('broken',true)`)
  await waitFor(() => evaluate<boolean>('window.__panel.failed'), Boolean)
  assert.equal(await shell.executeJavaScript(`window.__retainedShell===document`), true)
  await evaluate(`window.__panelPort.close();document.querySelector('#panel-probe').remove()`)
  await waitFor(async () => content.detached, Boolean)
  assert.equal(attempted.length, 0)
  console.log(
    `${name}: React UI, module reuse, clean sessions, context cancellation and sandbox passed`,
  )
}
