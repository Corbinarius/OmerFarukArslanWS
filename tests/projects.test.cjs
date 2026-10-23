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
function request(fields = {}, origin = 'https://archive.test') {
  const body = new FormData();
  const properties = {
    title:'STM32F429 LED',platform:'STM32F429',summary:'Tam GPIO projesi',
    color:'#a4c7e6',category:'Firmware',levels:JSON.stringify(['Basit']),
    tags:'GPIO, HAL',overview:'Bağlantılar\nDerleme',notes:'Test edildi',...fields
  };
  for (const [name, value] of Object.entries(properties)) if(value!==null)body.set(name,value);
  if (fields.file !== null) body.set('file', new File([new Uint8Array([0x50,0x4b,0x03,0x04,1,2])], 'led.zip', { type:'application/zip' }));
  return new Request('https://archive.test/.netlify/functions/projects',{method:'POST',headers:{origin},body});
}
const admin = { roles:['admin'] };
test('visitors list projects, but cannot publish or delete them', async () => {
  const {handler} = setup();
  assert.deepEqual(await (await handler(new Request('https://archive.test/projects'))).json(), {projects:[]});
  assert.equal((await handler(request())).status,401);
  assert.equal((await handler(new Request('https://archive.test/projects?id=bad',{method:'DELETE', headers:{origin:'https://archive.test'}}))).status,401);
});
test('non-admin cannot publish', async()=>{
  assert.equal((await setup({roles:['viewer']}).handler(request())).status,403);
});
test('admin can publish zipped project with multilevel tags and custom color',async()=>{
  const {handler, blobs}=setup(admin);
  const result=await handler(request({ title:'PLL & PWM', levels:JSON.stringify(['Orta','Zor']), color:'#cc3366'}));
  assert.equal(result.status,201);
  const { project }=await result.json();
  assert.deepEqual(project.levels,['Orta','Zor']);
  assert.deepEqual(project.tags,['GPIO','HAL']);
  assert.equal(project.color,'#cc3366');
  assert.equal(project.archive,true);
  const list=await (await handler(new Request('https://archive.test/projects'))).json();
  assert.equal(list.projects[0].title,'PLL & PWM');
  const download=await handler(new Request(`https://archive.test/projects?download=${project.id}`));
  assert.equal(download.status,200);
  assert.equal(download.headers.get('Content-Type'),'application/zip');
  assert.ok((await download.arrayBuffer()).byteLength > 0);
  assert.equal(blobs.size,2);
  const deleted=await handler(new Request(`https://archive.test/projects?id=${project.id}`,{method:'DELETE',headers:{origin:'https://archive.test'}}));
  assert.equal(deleted.status,200);
  assert.equal(blobs.size,0);
});
test('GitHub-only sources work without ZIP and can be downloaded from repository',async()=>{
  const {handler}=setup(admin);
  const result=await handler(request({file:null,repoUrl:'https://github.com/Corbinarius/OmerFarukArslanWS'}));
  assert.equal(result.status,201);
  const {project}=await result.json();
  assert.equal(project.archive,false);
  assert.equal(project.repoUrl,'https://github.com/Corbinarius/OmerFarukArslanWS');
  assert.equal((await handler(new Request(`https://archive.test/projects?download=${project.id}`))).status,404);
});
test('invalid metadata, non-ZIP content, missing sources, cross-origin publishing fail',async()=>{
  const {handler,blobs}=setup(admin);
  assert.equal((await handler(request({levels:JSON.stringify(['Admin'])}))).status,400);
  assert.equal((await handler(request({color:'red'}))).status,400);
  assert.equal((await handler(request({file:null}))).status,400);
  assert.equal((await handler(request({file:null,repoUrl:'javascript:alert(1)'}))).status,400);
  assert.equal((await handler(request({},'https://evil.test'))).status,403);
  assert.equal((await handler(new Request('https://archive.test/projects?download=../../etc/passwd'))).status,400);
  assert.equal(blobs.size,0);
});
