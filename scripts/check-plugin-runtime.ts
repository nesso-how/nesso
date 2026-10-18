import { app, BrowserWindow, dialog, protocol, session, type MessageBoxOptions, type WebFrameMain } from 'electron'
import { mkdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { serveAppAsset } from '../electron/asset-protocol.ts'
import { parseGraph, serializeGraph } from '@nesso/schema'
import { themeTokens } from '../packages/plugin/src/runtime.ts'
import { connectPlugins } from '../electron/plugins.ts'
import { createTrustedRequest } from '../electron/ipc.ts'
import { createDataLocation } from '../electron/data-location.ts'
import { connectDataLocation } from '../electron/data-location-ipc.ts'
import { connectDesktopPersistence } from '../electron/persistence.ts'
import { connectFiles } from '../electron/files.ts'
import { maxConceptLabelLength } from '../src/store/settings.ts'
import themeFixture from '../packages/plugin/test/theme.json' with { type: 'json' }

const profile = mkdtempSync(path.join(tmpdir(), 'nesso-plugin-test-'))
const attempted: string[] = []
let connectPersistence: (window: BrowserWindow) => void
app.setPath('userData', profile)
app.on('window-all-closed', () => {})
protocol.registerSchemesAsPrivileged([{ scheme: 'nesso', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const value = await read()
    if (ready(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail('Plugin runtime check timed out')
}

async function verifyDefinitions(window: BrowserWindow, url: string) {
  const state = { revision: 0, contextId: 'probe', locale: 'en', theme: Object.fromEntries(themeTokens.map((token) => [token, ''])), conceptPlacementOffset: { x: 160, y: 100 } }
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

async function drag(frame: WebFrameMain) {
  const node = await frame.executeJavaScript(`(()=>{const node=document.querySelector('.react-flow__node');const bounds=node.getBoundingClientRect();return {id:node.dataset.id,style:node.style.transform,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}})()`) as { id: string; style: string; x: number; y: number }
  await frame.executeJavaScript(`(async()=>{
    const node=document.querySelector('[data-id=${JSON.stringify(node.id)}]');
    const options={view:window,bubbles:true,button:0,buttons:1,clientX:${node.x},clientY:${node.y}};
    node.dispatchEvent(new MouseEvent('mousedown',options));
    for(let step=1;step<=10;step++){
      window.dispatchEvent(new MouseEvent('mousemove',{...options,clientX:options.clientX+step*2,clientY:options.clientY+step}));
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Animation frame stalled: '+document.visibilityState)),3000);requestAnimationFrame(()=>{clearTimeout(timer);resolve()})});
    }
    window.dispatchEvent(new MouseEvent('mouseup',{...options,buttons:0,clientX:options.clientX+20,clientY:options.clientY+10}));
  })()`)
  const position = () => frame.executeJavaScript(`document.querySelector('[data-id=${JSON.stringify(node.id)}]').style.transform`) as Promise<string>
  const moved = await waitFor(position, (value) => value !== node.style)
  await frame.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
  await waitFor(position, (value) => value === node.style)
  await frame.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[1].click()")
  await waitFor(position, (value) => value === moved)
}

async function click(window: BrowserWindow, label: string, selector = 'button') {
  const find = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(element=>element.textContent.trim()===${JSON.stringify(label)})`
  await waitFor(async () => window.webContents.executeJavaScript(`!!(${find})`) as Promise<boolean>, (value) => value)
  await window.webContents.executeJavaScript(`(${find}).click()`)
}

async function verifyActions(window: BrowserWindow, canvas: WebFrameMain, desktop: boolean) {
  const originalSave = dialog.showSaveDialog
  const originalOpen = dialog.showOpenDialog
  let savedName = ''
  let resolveOpen: (() => void) | undefined
  if (desktop) Object.assign(dialog, {
    showSaveDialog: async (_window: BrowserWindow, options: { defaultPath: string }) => { savedName = options.defaultPath; return { canceled: false, filePath: path.join(profile, savedName) } },
    showOpenDialog: () => new Promise((resolve) => { resolveOpen = () => resolve({ canceled: false, filePaths: [path.join(profile, 'import.jsonld')] }) }),
  })
  const savedFile = async (): Promise<{ name: string; text: string } | null> => {
    if (!desktop) return window.webContents.executeJavaScript('window.__savedFile')
    if (!savedName) return null
    try { return { name: savedName, text: await readFile(path.join(profile, savedName), 'utf8') } } catch { return null }
  }
  try {
    const count = () => canvas.executeJavaScript("document.querySelectorAll('.react-flow__node').length") as Promise<number>
    const view = async (name: string) => window.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(name)})).click()`)
    const menu = async () => window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Actions for Energy\"]').click()")
    await canvas.executeJavaScript("document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    if (!desktop) await window.webContents.executeJavaScript(`window.__savedFile=null;window.__resolveFile=null;Object.defineProperty(window,'nessoFiles',{configurable:true,value:{open:()=>new Promise(resolve=>{window.__resolveFile=resolve}),save:async(_id,options)=>{window.__savedFile=options;return {saved:true}},cancel:()=>{}}});void 0;`)
    await click(window, 'Export')
    await click(window, 'Save file')
    const saved = await waitFor(savedFile, (value) => !!value)
    assert.equal(saved!.name, 'nesso-graph.jsonld')
    assert.equal(parseGraph(JSON.parse(saved!.text)).concepts.length, 5)
    await waitFor(async () => window.webContents.executeJavaScript("document.querySelectorAll('body > iframe').length") as Promise<number>, (value) => value === 0)
    await menu()
    await click(window, 'Import', '[role=menuitem]')
    await click(window, 'Open file')
    await waitFor(async () => desktop ? !!resolveOpen : window.webContents.executeJavaScript("typeof window.__resolveFile==='function'") as Promise<boolean>, (value) => value)
    await view('Rest')
    await waitFor(count, (value) => value === 3)
    const imported = JSON.stringify(serializeGraph({ concepts: [{ id: 'urn:nesso:imported', label: 'From file', position: { x: 500, y: 500 } }], relationTypes: [], relations: [] }))
    if (desktop) { await writeFile(path.join(profile, 'import.jsonld'), imported); resolveOpen!() }
    else await window.webContents.executeJavaScript(`window.__resolveFile({name:'view.jsonld',mediaType:'application/ld+json',text:${JSON.stringify(imported)}})`)
    await waitFor(async () => window.webContents.executeJavaScript("document.querySelectorAll('body > iframe').length") as Promise<number>, (value) => value === 0)
    assert.equal(await count(), 3)
    await view('Energy')
    await waitFor(count, (value) => value === 4)
    assert.equal(await canvas.executeJavaScript("!!document.querySelector('.react-flow__node[aria-label=\"From file\"]')"), true)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 3)
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[1].click()")
    await waitFor(count, (value) => value === 4)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 3)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls-outside').click()")
    await waitFor(count, (value) => value === 5)
    assert.equal(await canvas.executeJavaScript("document.querySelectorAll('.graph-outside-node').length"), 2)
    assert.equal(await canvas.executeJavaScript("document.querySelectorAll('.graph-outside-node.selected').length"), 0)
    await menu()
    await click(window, 'Export', '[role=menuitem]')
    await click(window, 'Save file')
    const subset = await waitFor(savedFile, (value) => value?.name === 'nesso-energy.jsonld')
    assert.equal(parseGraph(JSON.parse(subset!.text)).concepts.length, 3)
    await waitFor(async () => window.webContents.executeJavaScript("document.querySelectorAll('body > iframe').length") as Promise<number>, (value) => value === 0)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls-outside').click()")
    await waitFor(count, (value) => value === 3)
    await view('All')
    await waitFor(count, (value) => value === 5)
    assert.equal(await canvas.executeJavaScript("document.querySelector('.react-flow__controls-outside').disabled"), true)
    const language = async (label: string) => {
      await window.webContents.executeJavaScript("document.querySelector('[data-settings-trigger]').click()")
      await waitFor(async () => window.webContents.executeJavaScript("!!document.querySelector('section[aria-labelledby=settings-interface] button')") as Promise<boolean>, (value) => value)
      await window.webContents.executeJavaScript("document.querySelector('section[aria-labelledby=settings-interface] button').click()")
      await click(window, label, '[role=option]')
      await window.webContents.executeJavaScript("document.querySelector('[role=dialog] header button').click()")
      await waitFor(async () => window.webContents.executeJavaScript("!document.querySelector('[role=dialog]')") as Promise<boolean>, (value) => value)
    }
    await language('Italiano')
    await click(window, 'Esporta')
    await click(window, 'Salva file')
    await waitFor(async () => window.webContents.executeJavaScript("[...document.querySelectorAll('.toast-title')].some(element=>element.textContent==='Export: Vista esportata')") as Promise<boolean>, (value) => value)
    await waitFor(async () => window.webContents.executeJavaScript("document.querySelectorAll('body > iframe').length") as Promise<number>, (value) => value === 0)
    resolveOpen = undefined
    if (!desktop) await window.webContents.executeJavaScript('window.__resolveFile=null')
    await click(window, 'Importa')
    await click(window, 'Apri file')
    await waitFor(async () => desktop ? !!resolveOpen : window.webContents.executeJavaScript("typeof window.__resolveFile==='function'") as Promise<boolean>, (value) => value)
    if (desktop) { await writeFile(path.join(profile, 'import.jsonld'), '{'); resolveOpen!() }
    else await window.webContents.executeJavaScript("window.__resolveFile({name:'invalid.jsonld',mediaType:'application/ld+json',text:'{'})")
    await waitFor(async () => window.webContents.executeJavaScript("[...document.querySelectorAll('.toast-description')].some(element=>element.textContent==='Impossibile importare questo file come vista di Nesso.')") as Promise<boolean>, (value) => value)
    assert.equal(await count(), 5)
    await window.webContents.executeJavaScript("document.querySelectorAll('[data-slot=toast] button').forEach(button=>button.click());true")
    await language('English')
  } finally { dialog.showSaveDialog = originalSave; dialog.showOpenDialog = originalOpen }
}

async function verifyClipboardLifecycle(window: BrowserWindow) {
  const count = () => window.webContents.executeJavaScript("document.querySelectorAll('.react-flow__node').length") as Promise<number>
  const view = (name: string) => window.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(${JSON.stringify(name)})).click()`)
  await window.webContents.executeJavaScript("document.querySelector('.react-flow__node').click();window.__delayWrite=true")
  await window.webContents.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[3].click()")
  await waitFor(async () => window.webContents.executeJavaScript("typeof window.__resolveWrite==='function'") as Promise<boolean>, (value) => value)
  await view('Energy')
  await waitFor(count, (value) => value === 3)
  await window.webContents.executeJavaScript('window.__delayWrite=false;window.__resolveWrite()')
  await view('All')
  await waitFor(count, (value) => value === 5)
  await window.webContents.executeJavaScript("window.__delayRead=true;document.querySelectorAll('.react-flow__controls.top.right button')[4].click()")
  await waitFor(async () => window.webContents.executeJavaScript("typeof window.__resolveRead==='function'") as Promise<boolean>, (value) => value)
  await view('Rest')
  await waitFor(count, (value) => value === 3)
  await view('All')
  await waitFor(count, (value) => value === 5)
  await window.webContents.executeJavaScript('window.__resolveRead(window.__clipboardText)')
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(await count(), 5)
  await window.webContents.executeJavaScript("window.__resolveRead=null;document.querySelectorAll('.react-flow__controls.top.right button')[4].click()")
  await waitFor(async () => window.webContents.executeJavaScript("typeof window.__resolveRead==='function'") as Promise<boolean>, (value) => value)
  window.setSize(700, 900)
  await waitFor(async () => window.webContents.executeJavaScript("!document.querySelector('.react-flow__controls.top.right')") as Promise<boolean>, (value) => value)
  await window.webContents.executeJavaScript('window.__resolveRead(window.__clipboardText)')
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(await count(), 5)
  window.setSize(1280, 900)
  await waitFor(async () => window.webContents.executeJavaScript("!!document.querySelector('.react-flow__controls.top.right')") as Promise<boolean>, (value) => value)
  await window.webContents.executeJavaScript('window.__delayRead=false')
}

async function verifyWorker(url: string, name: string) {
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
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, backgroundThrottling: false } })
  const timer = setTimeout(() => app.exit(1), 25_000)
  try {
    await window.loadURL(`${new URL('plugin-runner/actions.html', url)}#probe`)
    window.webContents.debugger.attach()
    const workers = async () => {
      const { targetInfos } = await window.webContents.debugger.sendCommand('Target.getTargets')
      return targetInfos.filter((target: { type: string }) => target.type === 'worker').length as number
    }
    const before = await workers()
    const state = { revision: 0, contextId: 'probe', locale: 'en', theme: Object.fromEntries(themeTokens.map((token) => [token, ''])), conceptPlacementOffset: { x: 160, y: 100 } }
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
  } finally { clearTimeout(timer); window.destroy() }
}

async function verifyExternal(window: BrowserWindow) {
  const original = dialog.showMessageBox
  const choices: { options: MessageBoxOptions; choose: (response: number) => void }[] = []
  Object.assign(dialog, { showMessageBox: (_window: BrowserWindow, options: MessageBoxOptions) => new Promise((resolve) => choices.push({ options, choose: (response) => resolve({ response, checkboxChecked: false }) })) })
  const manifest = { name: 'nesso-plugin-external-test', version: '1.0.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', styles: [], reads: ['view'], writes: ['concept.label'], capabilities: ['files.open'] }, i18n: { metadata: { name: { en: 'External test' }, description: { en: 'Integration fixture' }, documentation: { en: 'An isolated external action.' } } } }
  const code = `export const create=async({store,clipboard,files})=>{
    if(clipboard!==undefined)throw new Error('Unexpected clipboard API');
    await new Promise(resolve=>setTimeout(resolve,200));return [
    {id:'external-edit',label:{en:'External edit'},supportsViews:true,run:async()=>{
      const state=await store.refresh();await store.applyOperations(state.viewGraph.concepts.map(({id,label})=>({kind:'concept.label',id,value:'External '+label})),{atRevision:state.revision});
    }},
    {id:'external-wait',label:{en:'External wait'},supportsViews:true,run:async()=>{await files.open({extensions:['json'],mimeTypes:[]});await store.setConceptLabel(store.getState().viewGraph.concepts[0].id,'Late external write')}}
  ]}`
  const page = (expression: string) => window.webContents.executeJavaScript(expression)
  const list = () => page('window.nessoPlugins.list().then(result=>result.value.packages)')
  const propose = async (source = manifest, entry = code, replacing?: string, fonts: readonly { path: string; bytes: Uint8Array }[] = []) => {
    const assets = fonts.map(({ path, bytes }) => `{path:${JSON.stringify(path)},bytes:new Uint8Array(${JSON.stringify([...bytes])})}`)
    await page(`window.__externalResult=null;window.__externalId=crypto.randomUUID();window.nessoPlugins.propose(window.__externalId,{manifest:${JSON.stringify(source)},files:[{path:${JSON.stringify(source.nesso.entry)},bytes:new TextEncoder().encode(${JSON.stringify(entry)})}${assets.length ? `,${assets.join(',')}` : ''}]},'en',${JSON.stringify(replacing) ?? 'undefined'}).then(result=>window.__externalResult=result);void 0`)
    await waitFor(async () => choices.length, (value) => value > 0)
    return choices.shift()!
  }
  const finished = () => waitFor(() => page('window.__externalResult'), (value) => value !== null)
  const labels = () => page("[...document.querySelectorAll('.react-flow__node')].map(node=>node.getAttribute('aria-label'))")
  try {
    assert.ok('issues' in await page(`window.nessoPlugins.installNpm(crypto.randomUUID(),{name:'nesso-plugin-test',version:'latest'},'en')`))
    assert.equal(choices.length, 0)
    const cancelled = await propose()
    assert.equal(cancelled.options.defaultId, 0)
    assert.ok(cancelled.options.message!.includes(manifest.i18n.metadata.name.en))
    assert.ok(cancelled.options.detail!.includes(manifest.i18n.metadata.description.en))
    assert.ok(cancelled.options.detail!.includes(manifest.i18n.metadata.documentation.en))
    assert.match(cancelled.options.detail!, /complete document|complete graph/)
    assert.match(cancelled.options.detail!, /SHA-256: [a-f0-9]{64}/)
    assert.deepEqual(await list(), [])
    cancelled.choose(0)
    assert.deepEqual(await finished(), { value: null })
    const revoked = await propose()
    await page('window.nessoPlugins.cancel(window.__externalId);void 0')
    assert.deepEqual(await finished(), { value: null })
    revoked.choose(1)
    assert.deepEqual(await list(), [])
    const before = await labels()
    const approved = await propose()
    approved.choose(1)
    assert.ok('value' in await finished())
    assert.equal((await list()).length, 1)
    assert.deepEqual(await labels(), before)
    await page("document.querySelector('.react-flow__pane').click()")
    await click(window, 'External edit')
    await waitFor(labels, (value) => value.every((label: string) => label.startsWith('External ')))
    await page("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(labels, (value) => JSON.stringify(value) === JSON.stringify(before))
    const collision = await propose({ ...manifest, name: 'nesso-plugin-collision' }, code.replace('external-edit', 'import-view'))
    collision.choose(1)
    assert.ok('issues' in await finished())
    assert.equal((await list()).length, 1)
    await page("document.querySelectorAll('[data-tone=warning] button').forEach(button=>button.click());true")
    const [installed] = await list()
    const updateManifest = { ...manifest, version: '1.1.0', nesso: { ...manifest.nesso, capabilities: ['files.open', 'files.save'] } }
    const updateCode = code.replace("'External '+label", "'Updated '+label")
    const rejectedUpdate = await propose(updateManifest, updateCode, installed.contentId)
    assert.match(rejectedUpdate.options.message!, /Replace/)
    assert.match(rejectedUpdate.options.detail!, /files.save/)
    rejectedUpdate.choose(0)
    assert.deepEqual(await finished(), { value: null })
    assert.deepEqual(await list(), [installed])
    for (const invalid of ["throw new Error('Invalid update')", code.replace('external-edit', 'import-view')]) {
      const failedUpdate = await propose(updateManifest, invalid, installed.contentId)
      failedUpdate.choose(1)
      const reply = await finished()
      assert.ok('issues' in reply, JSON.stringify(reply))
      assert.deepEqual(await list(), [installed])
    }
    await click(window, 'External edit')
    await waitFor(labels, (value) => value.every((label: string) => label.startsWith('External ')))
    await page("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(labels, (value) => JSON.stringify(value) === JSON.stringify(before))
    await click(window, 'External wait')
    await waitFor(() => page("!!document.querySelector('[data-tone=confirmation]')"), (value) => value)
    const update = await propose(updateManifest, updateCode, installed.contentId)
    update.choose(1)
    assert.ok('value' in await finished())
    assert.equal(await page("document.querySelectorAll('[data-tone=confirmation]').length"), 0)
    const [updated] = await list()
    assert.equal(updated.version, '1.1.0')
    assert.notEqual(updated.contentId, installed.contentId)
    assert.equal((await list()).length, 1)
    await click(window, 'External edit')
    await waitFor(labels, (value) => value.every((label: string) => label.startsWith('Updated ')))
    await page("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(labels, (value) => JSON.stringify(value) === JSON.stringify(before))
    await click(window, 'External wait')
    await waitFor(() => page("!!document.querySelector('[data-tone=confirmation]')"), (value) => value)
    await click(window, 'Settings')
    await click(window, 'External test')
    await click(window, 'Disable')
    await waitFor(list, (value) => value[0].enabled === false)
    assert.equal(await page("document.querySelectorAll('[data-tone=confirmation]').length"), 0)
    await page('location.reload();void 0')
    await waitFor(() => page("!!document.querySelector('.react-flow__pane')"), (value) => value)
    assert.equal(await page("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='External edit')"), false)
    assert.deepEqual(await labels(), before)
    const disabledUpdate = await propose({ ...updateManifest, version: '1.2.0' }, updateCode, updated.contentId)
    disabledUpdate.choose(1)
    assert.ok('value' in await finished())
    assert.equal((await list())[0].enabled, false)
    assert.equal((await list())[0].version, '1.2.0')
    const conflicting = await propose({ ...manifest, name: 'nesso-plugin-enable-conflict', i18n: { metadata: { ...manifest.i18n.metadata, name: { en: 'Enable conflict' } } } })
    conflicting.choose(1)
    assert.ok('value' in await finished())
    await click(window, 'Settings')
    await click(window, 'External test')
    await click(window, 'Enable')
    await waitFor(() => page("!!document.querySelector('[data-tone=warning]')"), (value) => value)
    assert.equal((await list()).find((record: { name: string }) => record.name === manifest.name).enabled, false)
    await click(window, 'Enable conflict')
    await click(window, 'Remove plugin')
    await waitFor(list, (value) => value.length === 1)
    await click(window, 'External test')
    await click(window, 'Enable')
    await waitFor(list, (value) => value[0].enabled === true)
    assert.equal(choices.length, 0)
    const [enabled] = await list()
    const interrupted = await propose({ ...updateManifest, version: '1.3.0' }, updateCode.replace('setTimeout(resolve,200)', 'setTimeout(resolve,1000)'), enabled.contentId)
    interrupted.choose(1)
    await waitFor(() => page(`!!document.querySelector(${JSON.stringify(`iframe[title="${manifest.name}"]`)})`), (value) => value)
    await click(window, 'Disable')
    assert.deepEqual(await finished(), { value: null })
    await waitFor(list, (value) => value[0].enabled === false)
    await waitFor(() => page('document.querySelectorAll("body > iframe").length'), (value) => value === 0)
    assert.equal((await list())[0].contentId, enabled.contentId)
    await click(window, 'Enable')
    await waitFor(list, (value) => value[0].enabled === true)
    await page("document.querySelector('[role=dialog] button[aria-label=Close]').click()")
    const slow = await propose({ ...manifest, name: 'nesso-plugin-slow', i18n: { metadata: { ...manifest.i18n.metadata, name: { en: 'Slow test' } } } }, "export const create=async()=>{await new Promise(resolve=>setTimeout(resolve,500));return [{id:'slow-test',label:{en:'Slow action'},supportsViews:true,run:()=>{}}]}")
    slow.choose(1)
    assert.ok('value' in await finished())
    const restoring = await list()
    await page('location.reload();void 0')
    await waitFor(() => page(`!!document.querySelector(${JSON.stringify(`iframe[title="${restoring.find((record: { name: string }) => record.name === 'nesso-plugin-slow').name}"]`)})`), (value) => value)
    await click(window, 'Continue without external plugins')
    await waitFor(() => page("!!document.querySelector('.react-flow__pane')"), (value) => value)
    assert.equal(await page("[...document.querySelectorAll('button')].some(button=>['External edit','Slow action'].includes(button.textContent.trim()))"), false)
    assert.equal((await list()).length, 2)
    assert.deepEqual(await labels(), before)
    await page("sessionStorage.removeItem('nesso:skip-external-plugins');location.reload();void 0")
    await waitFor(() => page("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Slow action')"), (value) => value)
    await click(window, 'Settings')
    await click(window, 'Slow test')
    await click(window, 'Remove plugin')
    await waitFor(list, (value) => value.length === 1)
    await page("document.querySelector('[role=dialog] button[aria-label=Close]').click()")
    await page('location.reload();void 0')
    await waitFor(() => page("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='External edit')"), (value) => value)
    await click(window, 'External wait')
    await waitFor(() => page("!!document.querySelector('[data-tone=confirmation]')"), (value) => value)
    await click(window, 'Settings')
    await click(window, 'External test')
    await click(window, 'Remove plugin')
    await waitFor(list, (value) => value.length === 0)
    assert.equal(await page("document.querySelectorAll('[data-tone=confirmation]').length"), 0)
    assert.deepEqual(await labels(), before)
    await page("document.querySelector('[role=dialog] button[aria-label=Close]').click()")
    const font = new Uint8Array(await readFile('public/preinstalled/kernel/fonts/geist-latin-wght-normal.woff2'))
    const documentBefore = await page("window.nessoPersistence.read('document').then(result=>result.value)")
    for (const kind of ['vocab', 'theme'] as const) {
      const name = `External ${kind}`
      const source = { ...manifest, name: `nesso-plugin-external-${kind}`, nesso: { ...manifest.nesso, kind, reads: [], writes: [], capabilities: [] }, i18n: { metadata: { name: { en: name }, description: { en: 'Definition fixture' }, documentation: { en: 'An external isolated definition.' } } } }
      const definition = kind === 'vocab'
        ? { id: 'external-vocab', relationTypes: [{ id: 'urn:nesso:external:stable', label: 'External relation' }], defaultTypeId: 'urn:nesso:external:stable' }
        : { ...themeFixture, id: 'external-theme', metrics: { ...themeFixture.metrics, 'radius-control': 7 }, fonts: { ...themeFixture.fonts, sans: { faces: [{ path: 'fonts/sans.woff2', weight: [100, 900], style: 'normal' }] } } }
      const fonts = kind === 'theme' ? [{ path: 'fonts/sans.woff2', bytes: font }] : []
      const entry = `export const create=async({store,files,clipboard})=>{if(clipboard!==undefined)throw new Error('Unexpected clipboard API');if('viewGraph' in store.getState())throw new Error('Document data in discovery');try{await files.open({extensions:['json'],mimeTypes:[]});throw new Error('Unexpected capability')}catch(error){if(error.code!=='denied')throw error}return ${JSON.stringify(definition)}}`
      const consent = await propose(source, entry, undefined, fonts)
      assert.match(consent.options.detail!, kind === 'vocab' ? /Vocabulary/ : /Theme/)
      assert.doesNotMatch(consent.options.detail!, /Declared writes can affect/)
      if (kind === 'theme') assert.match(consent.options.detail!, /fonts\/sans\.woff2/)
      assert.deepEqual(await list(), [])
      consent.choose(1)
      assert.ok('value' in await finished())
      const [installed] = await list()
      await click(window, 'Settings')
      const fallback = kind === 'vocab' ? 'Base Vocabulary' : 'Kernel'
      await click(window, fallback, '[role=combobox]')
      await click(window, name, '[role=option]')
      await click(window, name)
      assert.equal(await page("document.querySelector('.settings-badge').textContent"), 'In use')
      const initialFont = await page("getComputedStyle(document.documentElement).getPropertyValue('--font-sans')")
      if (kind === 'theme') {
        assert.equal(await page("getComputedStyle(document.documentElement).getPropertyValue('--radius-control')"), '7px')
        assert.match(initialFont, /nesso-[a-f0-9]{64}-sans/)
        await page('document.fonts.ready.then(()=>true)')
      }
      const updatedSource = { ...source, version: '1.1.0' }
      for (const invalid of ["throw new Error('Invalid definition update')", `export const create=()=>(${JSON.stringify({ ...definition, id: kind === 'vocab' ? 'base-vocab' : 'kernel' })})`]) {
        const failed = await propose(updatedSource, invalid, installed.contentId, fonts)
        failed.choose(1)
        assert.ok('issues' in await finished())
        assert.deepEqual(await list(), [installed])
      }
      if (kind === 'theme') {
        const corrupt = await propose(updatedSource, entry, installed.contentId, [{ path: 'fonts/sans.woff2', bytes: new TextEncoder().encode('wOF2invalid') }])
        corrupt.choose(1)
        assert.ok('issues' in await finished())
        assert.deepEqual(await list(), [installed])
        assert.equal(await page("getComputedStyle(document.documentElement).getPropertyValue('--font-sans')"), initialFont)
      }
      const nextDefinition = kind === 'vocab'
        ? { ...definition, relationTypes: [{ id: 'urn:nesso:external:stable', label: 'Updated relation' }] }
        : { ...definition, metrics: { ...themeFixture.metrics, 'radius-control': 9 } }
      const nextCode = `export const create=async()=>{await new Promise(resolve=>setTimeout(resolve,200));return ${JSON.stringify(nextDefinition)}}`
      const update = await propose(updatedSource, nextCode, installed.contentId, fonts)
      update.choose(1)
      const updated = await finished()
      assert.ok('value' in updated, `${kind}: ${JSON.stringify(updated)}`)
      if (kind === 'vocab') await waitFor(() => page("document.querySelector('.settings-content').textContent.includes('Updated relation')"), (value) => value)
      else await waitFor(() => page("getComputedStyle(document.documentElement).getPropertyValue('--radius-control')"), (value) => value === '9px')
      const [current] = await list()
      const interrupted = await propose({ ...updatedSource, version: '1.2.0' }, nextCode.replace('setTimeout(resolve,200)', 'setTimeout(resolve,1000)'), current.contentId, fonts)
      interrupted.choose(1)
      await waitFor(() => page(`!!document.querySelector(${JSON.stringify(`iframe[title="${source.name}"]`)})`), (value) => value)
      await click(window, 'Disable')
      assert.deepEqual(await finished(), { value: null })
      await waitFor(list, (value) => value[0].enabled === false)
      assert.equal((await list())[0].contentId, current.contentId)
      await waitFor(() => page('document.querySelectorAll("body > iframe").length'), (value) => value === 0)
      if (kind === 'theme') assert.notEqual(await page("getComputedStyle(document.documentElement).getPropertyValue('--font-sans')"), initialFont)
      await click(window, 'General')
      assert.equal(await page(`[...document.querySelectorAll('[role=combobox]')].some(element=>element.textContent.trim()===${JSON.stringify(fallback)})`), true)
      await click(window, name)
      await click(window, 'Enable')
      await waitFor(list, (value) => value[0].enabled === true)
      assert.equal(choices.length, 0)
      await click(window, 'General')
      await click(window, fallback, '[role=combobox]')
      await click(window, name, '[role=option]')
      const key = kind === 'vocab' ? 'activeVocabId' : 'activeThemeId'
      await waitFor(() => page(`window.nessoPersistence.read('preferences').then(result=>result.value.preferences.${key})`), (value) => value === definition.id)
      await page('location.reload();void 0')
      await waitFor(() => page("!!document.querySelector('.react-flow__pane')"), (value) => value)
      await click(window, 'Settings')
      await click(window, name)
      assert.equal(await page("document.querySelector('.settings-badge').textContent"), 'In use')
      assert.equal(choices.length, 0)
      if (kind === 'theme') {
        await page('location.reload();void 0')
        await waitFor(() => page(`!!document.querySelector(${JSON.stringify(`iframe[title="${source.name}"]`)})`), (value) => value)
        await click(window, 'Continue without external plugins')
        await waitFor(() => page("!!document.querySelector('.react-flow__pane')"), (value) => value)
        await click(window, 'Settings')
        assert.equal(await page(`[...document.querySelectorAll('.settings-sidebar button')].some(element=>element.textContent.trim()===${JSON.stringify(name)})`), false)
        assert.equal(await page("document.documentElement.getAttribute('data-theme')"), 'kernel')
        await page("sessionStorage.removeItem('nesso:skip-external-plugins');location.reload();void 0")
        await waitFor(() => page("!!document.querySelector('.react-flow__pane')"), (value) => value)
        await click(window, 'Settings')
        await click(window, name)
      }
      await click(window, 'Remove plugin')
      await waitFor(list, (value) => value.length === 0)
      await click(window, 'General')
      assert.equal(await page(`[...document.querySelectorAll('[role=combobox]')].some(element=>element.textContent.trim()===${JSON.stringify(fallback)})`), true)
      assert.deepEqual(await page("window.nessoPersistence.read('document').then(result=>result.value)"), documentBefore)
      assert.deepEqual(await labels(), before)
      await page("document.querySelector('[role=dialog] button[aria-label=Close]').click()")
    }
    console.log('desktop: isolated external vocabulary/theme consent, stable document, local font decoding, failed updates, same-ID replacement, fallback, disable/enable, offline restoration and removal passed')
    console.log('desktop: exact-content install/update consent, failed-update preservation, atomic replacement/revocation, persistent disable/enable with collision checks, external edit/undo, absent clipboard API, atomic safe startup, offline reload and removal passed')
  } finally { dialog.showMessageBox = original }
}

async function verifySafeReload(window: BrowserWindow) {
  const page = (code: string) => window.webContents.executeJavaScript(code)
  const count = () => page("document.querySelectorAll('.react-flow__node').length") as Promise<number>
  const before = await count()
  const file = path.join(profile, 'document.json')
  const backup = `${file}.reload-backup`
  await waitFor(async () => parseGraph(JSON.parse(await readFile(file, 'utf8')).graph).concepts.length, (value) => value === before)
  const saved = await readFile(file, 'utf8')
  await rename(file, backup)
  await mkdir(file)
  try {
    await page("window.__reloadSentinel=true;document.querySelector('.react-flow__controls.top.right button:last-child').click()")
    await waitFor(count, (value) => value === before + 1)
    await click(window, 'Settings')
    await click(window, 'Reload without external plugins')
    await waitFor(() => page("document.querySelector('.settings-content [role=alert]')?.textContent"), (value) => !!value)
    assert.equal(await page('window.__reloadSentinel'), true)
    assert.equal(await page("sessionStorage.getItem('nesso:skip-external-plugins')"), null)
    assert.equal(await count(), before + 1)
    assert.equal(await readFile(backup, 'utf8'), saved)
  } finally {
    await rmdir(file)
    await rename(backup, file)
  }
  await click(window, 'Reload without external plugins')
  await waitFor(() => page("!window.__reloadSentinel&&!!document.querySelector('.react-flow__pane')"), (value) => value)
  assert.equal(await count(), before + 1)
  assert.equal(parseGraph(JSON.parse(await readFile(file, 'utf8')).graph).concepts.length, before + 1)
  assert.equal(await page("sessionStorage.getItem('nesso:skip-external-plugins')"), 'true')
  console.log('desktop: recovery reload stays open on a real storage write failure and retries only after saving the edited document')
}

async function verify(url: string, name: string) {
  const window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { sandbox: true, offscreen: true, backgroundThrottling: false, ...(name === 'desktop' ? { preload: path.resolve('dist-electron/electron/preload.cjs') } : {}) } })
  window.webContents.on('will-navigate', (event) => { if (event.url !== url) event.preventDefault() })
  if (name === 'desktop') connectPersistence(window)
  let stage = 'page loading'
  const deadline = setTimeout(() => {
    console.error(`${name}: timed out during ${stage}`)
    app.exit(1)
  }, 60_000)
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error' && !/Content Security Policy|sandboxed|violates|Refused to connect/.test(event.message)) console.error(event.message.slice(0, 2048))
  })
  try {
    await window.loadURL(url)
    stage = 'preview initialization'
    const canvas = window.webContents.mainFrame
    const count = () => canvas.executeJavaScript("document.querySelectorAll('.react-flow__node').length") as Promise<number>
    await waitFor(count, (value) => value === 1)
    const fontStatus = `(async()=>{await document.fonts.ready;const style=getComputedStyle(document.documentElement);const family=style.getPropertyValue('--font-sans').match(/nesso-[a-f0-9]{64}-sans/)?.[0];const monoFamily=style.getPropertyValue('--font-mono').match(/nesso-[a-f0-9]{64}-mono/)?.[0];await document.fonts.load('12px "'+monoFamily+'"');const loaded=name=>[...document.fonts].some(face=>face.status==='loaded'&&face.family.includes(name));return {family,monoFamily,loaded:loaded(family),monoLoaded:loaded(monoFamily)}})()`
    const hostFont = await window.webContents.executeJavaScript(fontStatus)
    assert.match(hostFont.family, /^nesso-[a-f0-9]{64}-sans$/)
    assert.equal(hostFont.loaded, true)
    assert.equal(hostFont.monoLoaded, true)
    assert.equal(await canvas.executeJavaScript("getComputedStyle(document.querySelector('.react-flow')).fontFamily.includes(getComputedStyle(document.documentElement).getPropertyValue('--font-sans').match(/nesso-[a-f0-9]{64}-sans/)[0])"), true)
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('body > iframe').length"), 0)
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.intro-canvas iframe').length"), 0)
    stage = 'readonly intro selection'
    await click(window, 'Continue')
    await click(window, 'Continue')
    await waitFor(count, (value) => value === 4)
    const label = await canvas.executeJavaScript("document.querySelector('.react-flow__node').click();document.querySelector('.react-flow__node').getAttribute('aria-label')") as string
    await waitFor(async () => window.webContents.executeJavaScript("document.querySelector('#concept-label')?.value") as Promise<string>, (value) => value === label)
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#concept-label').readOnly"), true)
    await window.webContents.executeJavaScript("document.querySelector('.intro-header button').click()")
    stage = 'canvas initialization'
    await waitFor(count, (value) => value === 4)
    stage = 'plugin settings without renderer'
    await click(window, 'Settings')
    await waitFor(async () => window.webContents.executeJavaScript("!!document.querySelector('.settings-sidebar')") as Promise<boolean>, (value) => value)
    assert.deepEqual(await window.webContents.executeJavaScript("[...document.querySelectorAll('.settings-sidebar button')].map(button=>button.textContent.trim()).filter(label=>!['General','About','AI'].includes(label))"), ['Kernel', 'Base Vocabulary', 'Export', 'Import'])
    await window.webContents.executeJavaScript("document.querySelector('[role=dialog] button[aria-label=Close]').click()")
    await waitFor(async () => window.webContents.executeJavaScript("!document.querySelector('[role=dialog]')") as Promise<boolean>, (value) => value)
    stage = 'locked canvas creation'
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls-interactive').click()")
    assert.equal(await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:last-child').disabled"), true)
    await canvas.executeJavaScript("document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:300,clientY:300}))")
    assert.equal(await count(), 4)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls-interactive').click()")
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:last-child').click()")
    await waitFor(count, (value) => value === 5)
    stage = 'inline concept editing'
    await waitFor(async () => canvas.executeJavaScript("!!document.querySelector('.concept-node input')") as Promise<boolean>, (value) => value)
    const editing = await canvas.executeJavaScript("(()=>{const input=document.querySelector('.concept-node input');return {id:input.closest('.react-flow__node').dataset.id,label:input.value,maxLength:input.maxLength}})()") as { id: string; label: string; maxLength: number }
    assert.equal(editing.maxLength, maxConceptLabelLength)
    const editedLabel = () => canvas.executeJavaScript(`document.querySelector(${JSON.stringify(`.react-flow__node[data-id="${editing.id}"]`)}).getAttribute('aria-label')`) as Promise<string>
    await canvas.executeJavaScript("(()=>{const input=document.querySelector('.concept-node input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Inline label');input.dispatchEvent(new Event('input',{bubbles:true}))})()")
    await canvas.executeJavaScript("document.querySelector('.concept-node input').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))")
    await waitFor(editedLabel, (value) => value === 'Inline label')
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(editedLabel, (value) => value === editing.label)
    await canvas.executeJavaScript(`document.querySelector(${JSON.stringify(`.react-flow__node[data-id="${editing.id}"] .concept-node`)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
    await waitFor(async () => canvas.executeJavaScript("!!document.querySelector('.concept-node input')") as Promise<boolean>, (value) => value)
    await canvas.executeJavaScript("document.querySelector('.concept-node input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
    await waitFor(async () => canvas.executeJavaScript("!document.querySelector('.concept-node input')") as Promise<boolean>, (value) => value)
    assert.equal(await editedLabel(), editing.label)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 4)
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[1].click()")
    await waitFor(count, (value) => value === 5)
    await drag(canvas)
    stage = 'host full-view deletion'
    const relationCount = () => canvas.executeJavaScript("document.querySelectorAll('.react-flow__edge').length") as Promise<number>
    const beforeRelations = await relationCount()
    await canvas.executeJavaScript("document.querySelector('#canvas [tabindex=\"0\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}));")
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[5].click()")
    await waitFor(async () => window.webContents.executeJavaScript("!!document.querySelector('[role=dialog]')") as Promise<boolean>, (value) => value)
    assert.equal(await count(), 5)
    await click(window, 'Cancel', '[role=dialog] button')
    await waitFor(async () => window.webContents.executeJavaScript("!document.querySelector('[role=dialog]')") as Promise<boolean>, (value) => value)
    assert.equal(await count(), 5)
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[5].click()")
    await click(window, 'Delete', '[role=dialog] button')
    await waitFor(count, (value) => value === 1)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 5)
    stage = 'selection-aware pane creation'
    await waitFor(relationCount, (value) => value === beforeRelations)
    await canvas.executeJavaScript("document.querySelector('.react-flow__node').click()")
    await canvas.executeJavaScript("(()=>{const pane=document.querySelector('.react-flow__pane');for(const detail of [1,2])pane.dispatchEvent(new MouseEvent('click',{bubbles:true,detail,clientX:300,clientY:300}));pane.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:300,clientY:300}))})()")
    await waitFor(count, (value) => value === 6)
    await waitFor(relationCount, (value) => value === beforeRelations + 1)
    await canvas.executeJavaScript("document.querySelector('.concept-node input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 5)
    await waitFor(relationCount, (value) => value === beforeRelations)
    await canvas.executeJavaScript("document.querySelector('.react-flow__node').click()")
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('#canvas iframe').length"), 0)
    stage = 'direct clipboard'
    await window.webContents.executeJavaScript(`window.__clipboardText='';Object.defineProperty(navigator.clipboard,'writeText',{value:async text=>{window.__clipboardText=text;if(window.__delayWrite)await new Promise(resolve=>{window.__resolveWrite=resolve})}});Object.defineProperty(navigator.clipboard,'readText',{value:async()=>window.__delayRead?new Promise(resolve=>{window.__resolveRead=resolve}):window.__clipboardText});`)
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[2].click()")
    await waitFor(async () => window.webContents.executeJavaScript("window.__clipboardText.length") as Promise<number>, (value) => value > 0)
    await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[4].click()")
    await waitFor(count, (value) => value === 6)
    await canvas.executeJavaScript("document.querySelector('.react-flow__controls.top.right button:first-child').click()")
    await waitFor(count, (value) => value === 5)
    stage = 'clipboard error feedback'
    const invalidGraph = JSON.stringify(serializeGraph({ concepts: [{ id: 'urn:nesso:probe:invalid', label: 'Invalid'.repeat(100), position: { x: 0, y: 0 } }], relationTypes: [], relations: [] }))
    for (const [text, title] of [['{', 'Could not paste: the clipboard must contain a valid Nesso graph.'], [invalidGraph, 'The canvas command could not be applied.']]) {
      await window.webContents.executeJavaScript(`window.__clipboardText=${JSON.stringify(text)}`)
      await canvas.executeJavaScript("document.querySelectorAll('.react-flow__controls.top.right button')[4].click()")
      const warnings = () => window.webContents.executeJavaScript("[...document.querySelectorAll('[data-slot=toast][data-tone=warning] .toast-title')].map(element=>element.textContent)") as Promise<string[]>
      await waitFor(warnings, (value) => value.length > 0)
      await new Promise((resolve) => setTimeout(resolve, 100))
      assert.deepEqual(await warnings(), [title])
      assert.equal(await count(), 5)
      await window.webContents.executeJavaScript("document.querySelector('[data-slot=toast][data-tone=warning] button').click()")
      await waitFor(warnings, (value) => value.length === 0)
    }
    stage = 'clipboard navigation and readonly changes'
    await verifyClipboardLifecycle(window)
    stage = 'isolated actions and file mediation'
    await verifyActions(window, canvas, name === 'desktop')
    stage = 'native paste'
    const text = JSON.stringify(serializeGraph({ concepts: [{ id: 'urn:probe:paste', label: 'Pasted', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] }))
    await canvas.executeJavaScript(`const data=new DataTransfer();data.setData('text/plain',${JSON.stringify(text)});document.querySelector('#canvas [tabindex="0"]').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));`)
    await waitFor(count, (value) => value === 6)
    await canvas.executeJavaScript(`document.querySelector('.react-flow__node[aria-label="Pasted"]').click()`)
    await waitFor(async () => canvas.executeJavaScript("document.querySelector('#concept-label')?.value") as Promise<string>, (value) => value === 'Pasted')
    stage = 'definition resource policy'
    await verifyDefinitions(window, url)
    if (name === 'desktop') {
      stage = 'external installation'
      await verifyExternal(window)
      stage = 'recovery reload persistence'
      await verifySafeReload(window)
    }
    console.log(`${name}: trusted preview/canvas, inline labels, selection-aware creation, confirmed full-view deletion/undo, isolated actions/definitions, fixed-view import/export, drag/history, direct clipboard, native paste, denied plugin resources and blocked same-runner navigation passed`)
  } catch (error) {
    console.error(`${name}: failed during ${stage}`)
    throw error
  } finally { clearTimeout(deadline); window.destroy() }
  await verifyWorker(url, name)
}

app.whenReady().then(async () => {
  const trusted = createTrustedRequest(false)
  const location = await createDataLocation(profile)
  const dataLocation = connectDataLocation(trusted, location, () => false)
  connectPersistence = connectDesktopPersistence(trusted, location, dataLocation.locked)
  connectFiles(trusted)
  connectPlugins(trusted)
  const root = path.resolve(import.meta.dirname, '../dist')
  protocol.handle('nesso', (request) => serveAppAsset(root, request))
  session.defaultSession.webRequest.onBeforeRequest((request, callback) => { if (request.url.includes('plugin-probe')) attempted.push(request.url); callback({}) })
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const file = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)}`)
      if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return }
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file))
    } catch { response.writeHead(404).end() }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await verify('nesso://app/', 'desktop')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    await verify(`http://127.0.0.1:${address.port}/`, 'static-web')
  } finally { server.close() }
  console.log(`Isolated test profile: ${profile}`)
  app.exit(0)
}).catch((error: unknown) => { console.error(error); app.exit(1) })
