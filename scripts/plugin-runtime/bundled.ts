import assert from 'node:assert/strict'
import { parseGraph, serializeGraph } from '@nesso-how/schema'
import { parseContribution, parseDefinition, type ActionState } from '../../packages/plugin/src/runtime.ts'
import { actionState, waitFor, type CheckContext } from './helpers.ts'

type Probe = {
  done: boolean
  contribution: unknown
  discoveryRequests: number
  requests: { method: string; params: { name?: string; text?: string } }[]
  complete?: { ok: boolean; error?: { code: string } }
  error?: string
}

export async function verifyBundled({ window, url }: CheckContext) {
  const graph = { concepts: [{ id: 'urn:probe:concept', label: 'Probe', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] }
  const state: ActionState = { ...actionState(), viewGraph: graph }
  const file = { name: 'graph.jsonld', mediaType: 'application/ld+json', text: JSON.stringify(serializeGraph(graph)) }
  for (const [name, phase] of [['import', 'discovery'], ['export', 'discovery'], ['import', 'run'], ['export', 'run'], ['import', 'conflict']] as const) {
    const invocation = phase !== 'discovery'
    const conflict = phase === 'conflict'
    const runner = new URL('plugin-runner/actions.html', url)
    await window.webContents.executeJavaScript(`(async()=>{
      window.__bundled={done:false,contribution:null,discoveryRequests:0,requests:[]};
      const response=await fetch(${JSON.stringify(new URL(`preinstalled/${name}/index.js`, url).href)});
      if(!response.ok)throw new Error('Could not load bundled plugin: '+${JSON.stringify(name)});
      const bytes=new Uint8Array(await response.arrayBuffer());
      const entry='data:text/javascript;base64,'+btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      const frame=document.createElement('iframe');frame.id='bundled-probe';frame.sandbox='allow-scripts';frame.hidden=true;
      const loaded=new Promise(resolve=>frame.onload=resolve);frame.src=${JSON.stringify(`${runner}#probe`)};document.body.append(frame);await loaded;
      const channel=new MessageChannel();window.__bundledPort=channel.port1;
      channel.port1.onmessage=({data})=>{
        const result=window.__bundled;
        if(data.type==='contribution'){
          result.contribution=data.value;result.discoveryRequests=result.requests.length;
          if(${invocation}){
            channel.port1.postMessage({type:'invoke',actionId:data.value[0].id,state:${JSON.stringify(state)}});
          }else result.done=true;
        }
        if(data.type==='request'){
          result.requests.push({method:data.method,params:data.params});
          if(data.method==='store.refresh')channel.port1.postMessage({type:'state',state:${JSON.stringify(state)}});
          if(${conflict}&&data.method==='files.open'){
            channel.port1.postMessage({type:'response',id:data.id,ok:true,value:${JSON.stringify(file)}});return;
          }
          if(${conflict}&&data.method==='store.applyOperations'){
            channel.port1.postMessage({type:'response',id:data.id,ok:false,error:{code:'stale-state',issues:[{path:'action',message:'Snapshot changed before commit'}]}});return;
          }
          const allowed=['store.refresh','files.open','files.save'].includes(data.method);
          channel.port1.postMessage({type:'response',id:data.id,ok:allowed,...(allowed?{value:data.method==='files.save'?{saved:false}:null}:{error:{code:'denied',issues:[{path:'probe',message:'Unexpected request'}]}})});
        }
        if(data.type==='complete'){result.complete=data;result.done=true}
        if(data.type==='close'){result.error=data.reason;result.done=true}
      };
      frame.contentWindow.postMessage({type:'bootstrap',token:'probe',entry},'*',[channel.port2]);
    })()`)
    try {
      const result = await waitFor(async () => window.webContents.executeJavaScript('window.__bundled') as Promise<Probe>, (value) => value.done)
      assert.equal(result.error, undefined, name)
      assert.equal(result.discoveryRequests, 0, name)
      const descriptors = parseContribution('actions', result.contribution)
      assert.deepEqual(descriptors.map(({ id }) => id), [`${name}-view`])
      if (invocation) {
        assert.equal(result.complete?.ok, !conflict, name)
        if (conflict) assert.equal(result.complete?.error?.code, 'stale-state')
        assert.deepEqual(result.requests.map(({ method }) => method), conflict ? ['files.open', 'store.refresh', 'store.applyOperations'] : name === 'import' ? ['files.open'] : ['store.refresh', 'files.save'])
        if (name === 'export') {
          const saved = result.requests.find(({ method }) => method === 'files.save')!.params
          assert.equal(saved.name, 'nesso-graph.jsonld')
          assert.deepEqual(parseGraph(JSON.parse(saved.text!)), graph)
        }
      } else assert.deepEqual(result.requests, [])
    } finally {
      await window.webContents.executeJavaScript("window.__bundledPort.close();document.querySelector('#bundled-probe').remove()")
    }
  }
  for (const [name, kind] of [['kernel-theme', 'theme'], ['paper-theme', 'theme'], ['base-vocab', 'vocab']] as const) {
    const response = await window.webContents.executeJavaScript(`fetch(${JSON.stringify(new URL(`preinstalled/${name}/definition.json`, url).href)}).then(async response=>({ok:response.ok,text:await response.text()}))`) as { ok: boolean; text: string }
    assert.equal(response.ok, true, name)
    const definition = parseDefinition(kind, JSON.parse(response.text))
    assert.equal(definition.id, name)
    if ('fonts' in definition) {
      const paths = [...new Set([...definition.fonts.sans.faces, ...definition.fonts.mono.faces].map(({ path }) => `preinstalled/${name}/${path}`))]
      assert.ok(paths.length > 0)
      await window.webContents.executeJavaScript(`Promise.all(${JSON.stringify(paths)}.map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Could not load bundled font');await new FontFace('probe',await response.arrayBuffer()).load()})).then(()=>true)`)
    }
  }
}
