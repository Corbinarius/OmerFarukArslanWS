const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('netlify/functions/projects.mts', 'utf8')
  .replace(/^import .*;\n/gm,'').replace('export default', 'const handler =');
function setup(user = null) {
  const blobs = new Map();
  const store = {
    list: async ({ prefix }) => ({ blobs: [...blobs.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})) }),
    set: async (key, value) => { blobs.set(key, value); },
    setJSON: async (key, value) => { blobs.set(key, structuredClone(value)); },
    get: async (key, {type}={}) => {
      if (!blobs.has(key)) return null;
      const value = blobs.get(key);
      return type === 'stream' ? new Blob([value]).stream() : value;
    },
    delete: async key => { blobs.delete(key); }
  };
  const f = new Function('getStore','getUser','refreshSession','verifyRequestOrigin', stripTypeScriptTypes(source)+'\nreturn handler;');
  const handler = f(() => store, async()=>user, async()=>{}, request => {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw Object.assign(new Error('Origin denied'),{ status:403 });
  });
  return { handler, blobs };
}
function request(options = {}, origin = 'https://archive.test') {
  const body = new FormData();
  const properties = {
    title:'STM32F429 LED',platform:'STM32F429',summary:'Tam GPIO projesi',
    color:'#a4c7e6',category:'Firmware',levels:JSON.stringify(['Basit']),
    tags:'GPIO, HAL',overview:'Bağlantılar\nDerleme',notes:'Test edildi',repoUrl:'',
    ...options.fields
  };
  for (const [name, value] of Object.entries(properties)) if(value!==null)body.set(name,value);
  const files=options.files??[{path:'src/main.c',content:'#include "main.h"\nint main(void) { return 0; }'}, {path:'include/main.h',content:'#pragma once\n'}];
  for (const file of files) body.append('sources', new File([file.content],file.path.split('/').at(-1)));
  body.set('sourcePaths', options.paths ? JSON.stringify(options.paths) : JSON.stringify(files.map(f=>f.path)));
  return new Request('https://archive.test/.netlify/functions/projects',{method:'POST',headers:{origin},body});
}
const admin = { roles:['admin'] };
const get = (handler, query='') => handler(new Request(`https://archive.test/projects${query}`));

test('visitors can list projects but cannot publish/delete',async()=>{
  const {handler}=setup();
  assert.deepEqual(await (await get(handler)).json(), {projects:[]});
  assert.equal((await handler(request())).status,401);
  assert.equal((await handler(new Request('https://archive.test/projects?id=bad',{method:'DELETE', headers:{origin:'https://archive.test'}}))).status,401);
});
test('non-admin cannot publish',async()=>{
  assert.equal((await setup({roles:['viewer']}).handler(request())).status,403);
});
test('admin publishes individual source files with levels, paths and custom platform color',async()=>{
  const {handler,blobs}=setup(admin);
  const result=await handler(request({fields:{title:'PLL & PWM',levels:JSON.stringify(['Orta','Zor']),color:'#cc3366'}}));
  assert.equal(result.status,201);
  const { project }=await result.json();
  assert.deepEqual(project.levels,['Orta','Zor']);
  assert.deepEqual(project.tags,['GPIO','HAL']);
  assert.equal(project.color,'#cc3366');
  assert.equal(project.archive,false);
  assert.deepEqual(project.sourceFiles.map(f=>f.path),['src/main.c','include/main.h']);
  const list=await (await get(handler)).json();
  assert.equal(list.projects[0].title,'PLL & PWM');
  assert.equal(JSON.stringify(list).includes('#include'),false,'catalog does not contain source content');
  const first=await get(handler,`?source=${project.id}&index=0`);
  assert.equal(first.status,200);
  assert.deepEqual(await first.json(),{path:'src/main.c',content:'#include "main.h"\nint main(void) { return 0; }'});
  assert.equal(blobs.size,3);
  assert.equal((await get(handler,`?source=${project.id}&index=2`)).status,404);
  const deleted=await handler(new Request(`https://archive.test/projects?id=${project.id}`,{method:'DELETE',headers:{origin:'https://archive.test'}}));
  assert.equal(deleted.status,200);
  assert.equal(blobs.size,0);
});
test('GitHub-only projects can be published without source upload',async()=>{
  const {handler}=setup(admin);
  const result=await handler(request({files:[],fields:{repoUrl:'https://github.com/Corbinarius/OmerFarukArslanWS'}}));
  assert.equal(result.status,201);
  const {project}=await result.json();
  assert.equal(project.sourceFiles.length,0);
  assert.equal(project.repoUrl,'https://github.com/Corbinarius/OmerFarukArslanWS');
  assert.equal((await get(handler,`?source=${project.id}&index=0`)).status,404);
});
test('legacy ZIP projects still support existing downloads',async()=>{
  const {handler,blobs}=setup(admin);
  const id='11111111-2222-4333-8444-555555555555';
  blobs.set(`records/${id}.json`,{id,archive:true});
  blobs.set(`files/${id}.zip`,new Uint8Array([0x50,0x4b,0x03,0x04,0]));
  const response=await get(handler,`?download=${id}`);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'application/zip');
});
test('invalid metadata, paths, missing code and cross-origin writes are rejected',async()=>{
  const {handler,blobs}=setup(admin);
  for(const options of [
    {fields:{levels:JSON.stringify(['Admin'])}},
    {fields:{color:'red'}},
    {fields:{repoUrl:'javascript:alert(1)'},files:[]},
    {files:[]},
    {paths:['../../secret.c','src/other.h']},
    {paths:['.env','include/main.h']},
    {paths:['src/main.c','src/main.c']},
    {files:[{path:'src/main.c',content:'hello\u0000bad'}]},
    {files:[{path:'src/script.js',content:'alert(1)'}]},
  ]) assert.ok([400,413].includes((await handler(request(options))).status),JSON.stringify(options));
  assert.equal((await handler(request({},'https://evil.test'))).status,403);
  assert.equal((await get(handler,'?source=../../etc/passwd&index=0')).status,400);
  assert.equal((await get(handler,'?source=11111111-2222-4333-8444-555555555555&index=../../x')).status,400);
  assert.equal(blobs.size,0);
});
test('per-file and aggregate source size limits are enforced',async()=>{
  const {handler}=setup(admin);
  const tooBig=[{path:'src/large.c',content:'X'.repeat(256*1024+1)}];
  assert.equal((await handler(request({files:tooBig}))).status,400);
  const tooMany=Array.from({length:51},(_,i)=>({path:`src/a${i}.c`,content:'a'}));
  assert.equal((await handler(request({files:tooMany}))).status,400);
});

const CHUNK=512*1024;
const digest=async bytes=>Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
function uploadRequest(action,id,body,part){return new Request(`https://archive.test/projects?action=${action}${id?'&id='+id:''}${part!==undefined?'&part='+part:''}`,{method:action==='part'?'PUT':'POST',headers:{origin:'https://archive.test'},body});}
async function begin(handler,manifest,hashes){const req=request({files:[],fields:{manifest:JSON.stringify(manifest),chunkHashes:JSON.stringify(hashes)}});return handler(new Request(req.url+'?action=begin',req));}
test('exactly 100 MiB uploads as 200 bounded requests; unpublished chunks stay private; full data survives',async()=>{
 const {handler,blobs}=setup({id:'owner',roles:['admin']});
 const bytes=new Uint8Array(CHUNK).fill(65),hash=await digest(bytes),size=100*1024*1024;
 const result=await begin(handler,[{path:'src/large.c',size,offset:0}],Array(200).fill(hash));assert.equal(result.status,201);
 const {id}=await result.json();
 assert.equal((await get(handler,`?chunks=${id}&part=0`)).status,404);
 assert.equal((await handler(uploadRequest('complete',id))).status,409);
 for(let i=0;i<200;i++)assert.equal((await handler(uploadRequest('part',id,bytes,i))).status,200);
 const completed=await handler(uploadRequest('complete',id));assert.equal(completed.status,201);
 const {project}=await completed.json();assert.equal(project.size,size);assert.equal(project.sourceFiles[0].size,size);
 const catalog=await(await get(handler)).json();assert.equal(catalog.projects[0].sourceFiles.length,0);assert.equal(catalog.projects[0].fileCount,1);
 const manifest=await(await get(handler,`?manifest=${id}`)).json();assert.equal(manifest.sourceFiles[0].offset,0);
 assert.deepEqual(new Uint8Array(await(await get(handler,`?chunks=${id}&part=199`)).arrayBuffer()),bytes);
 assert.equal((await handler(uploadRequest('complete',id))).status,200,'publish retries are idempotent');
 assert.equal((await handler(new Request(`https://archive.test/projects?id=${id}`,{method:'DELETE',headers:{origin:'https://archive.test'}}))).status,200);
 assert.equal(blobs.size,0);
});
test('100 MiB + 1 byte, unsafe paths, mismatched offsets, oversized and corrupt chunks rejected',async()=>{
 const {handler}=setup({id:'owner',roles:['admin']});const bytes=new Uint8Array([65,66]),hash=await digest(bytes);
 assert.equal((await begin(handler,[{path:'a.c',size:100*1024*1024+1,offset:0}],[])).status,413);
 for(const manifest of [[{path:'../a.c',size:2,offset:0}],[{path:'a.c',size:2,offset:1}],[{path:'a.c',size:-1,offset:0}]])assert.equal((await begin(handler,manifest,[hash])).status,400);
 const {id}=await(await begin(handler,[{path:'a.c',size:2,offset:0}],[hash])).json();
 assert.equal((await handler(uploadRequest('part',id,new Uint8Array([1,2]),0))).status,400);
 assert.equal((await handler(uploadRequest('part',id,new Uint8Array([1,2,3]),0))).status,413);
 assert.equal((await handler(uploadRequest('part',id,bytes,1))).status,400);
 assert.equal((await handler(uploadRequest('part',id,bytes,0))).status,200);
 assert.equal((await handler(uploadRequest('part',id,bytes,0))).status,200);
 assert.deepEqual((await(await handler(uploadRequest('status',id))).json()).missing,[]);
});
test('owner isolation and expired sessions enforced',async()=>{
 const {handler,blobs}=setup({id:'owner',roles:['admin']});
 const {id}=await(await begin(handler,[{path:'empty.h',size:0,offset:0}],[])).json();
 const draft=blobs.get(`drafts/${id}.json`);draft.owner='someone-else';assert.equal((await handler(uploadRequest('complete',id))).status,404);
 draft.owner='owner';draft.startedAt=0;assert.equal((await handler(uploadRequest('complete',id))).status,410);
 assert.equal((await setup().handler(uploadRequest('part',id,new Uint8Array([1]),0))).status,401);
});
test('browser uploader resumes missing chunks and packs many small files; viewer reads cross-chunk ranges',async()=>{
 const vm=require('node:vm');const {handler}=setup({id:'owner',roles:['admin']});let fail=true;const sent=[];
 const mockedFetch=async(url,options={})=>{
  const u=new URL(url,'https://archive.test');
  if(u.searchParams.get('action')==='part'){const part=Number(u.searchParams.get('part'));sent.push(part);if(part===1&&fail)throw Error('Connection lost');}
  return handler(new Request(u,{...options,headers:{...options.headers,origin:'https://archive.test'}}));
 };
 const scope={window:{},fetch:mockedFetch,AbortSignal,TextDecoder,TextEncoder,Uint8Array,Blob,FormData,crypto,setTimeout:fn=>setTimeout(fn,0)};
 vm.runInNewContext(fs.readFileSync('public/assets/project-upload.js','utf8'),scope);
 const files=[{path:'src/a.c',file:new File(['a'.repeat(CHUNK-4)],'a.c')},{path:'include/b.h',file:new File(['İtest'.repeat(60000)],'b.h')},...Array.from({length:55},(_,i)=>({path:`src/${i}.c`,file:new File(['//c'],'c')}))];
 const form=new FormData();for(const [k,v] of Object.entries({title:'Large',platform:'STM32',summary:'Chunk test',color:'#a4c7e6',levels:'["Basit"]'}))form.set(k,v);
 await assert.rejects(scope.window.ProjectUpload.publish(files,form,()=>{}),/Connection lost/);
 fail=false;const result=await scope.window.ProjectUpload.publish(files,form,()=>{});assert.equal(result.project.sourceFiles.length,57);assert.equal(sent.filter(i=>i===0).length,1,'successful chunk is not uploaded twice');
 const viewerScope={window:{},fetch:mockedFetch,AbortSignal,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,URL,atob};
 vm.runInNewContext(fs.readFileSync('public/assets/source-browser.js','utf8'),viewerScope);
 const viewer=viewerScope.window.SourceBrowser,p=result.project,f=p.sourceFiles[1];
 const preview=await viewer.content(p,f,1);assert.ok(preview.startsWith('İtest'));assert.ok(preview.length<f.size);
 const downloaded=await viewer.download(p,f,1);assert.equal(await downloaded.text(),'İtest'.repeat(60000));
});
