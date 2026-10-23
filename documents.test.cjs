const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
function setup(user = null) {
  const blobs = new Map();
  const source = fs.readFileSync('netlify/functions/documents.mts', 'utf8').replace(/^import .*;\n/gm, '').replace('export default', 'const handler =');
  const js = stripTypeScriptTypes(source);
  const store = { list: async () => ({ blobs: [...blobs.keys()].map(key => ({ key })) }), set: async (key, data) => blobs.set(key, data), get: async key => blobs.has(key) ? new Blob([blobs.get(key)]).stream() : null };
  const handler = new Function('getStore', 'getUser', 'refreshSession', 'verifyRequestOrigin', js + '\nreturn handler;')(
    () => store, async () => user, async () => {}, request => { if (request.headers.get('origin') !== new URL(request.url).origin) throw Object.assign(Error('Origin denied'), { status: 403 }); });
  return { handler, blobs };
}
function upload(name = 'datasheet.pdf', content = '%PDF-1.7\nexample', origin = 'https://archive.test') {
  const body = new FormData(); body.set('file', new File([content], name, { type: 'application/pdf' }));
  return new Request('https://archive.test/.netlify/functions/documents', { method: 'POST', headers: { origin }, body });
}
test('visitors can list documents but cannot upload', async () => {
  const { handler } = setup();
  assert.equal((await handler(new Request('https://archive.test/api'))).status, 200);
  assert.equal((await handler(upload())).status, 401);
});
test('authenticated accounts without admin role cannot upload', async () => {
  assert.equal((await setup({ roles: [] }).handler(upload())).status, 403);
});
test('admin upload persists a PDF and allows public list and download', async () => {
  const { handler, blobs } = setup({ roles: ['admin'] });
  const response = await handler(upload('STM32 datasheet.pdf'));
  assert.equal(response.status, 201);
  const { file } = await response.json(); assert.equal(blobs.size, 1);
  const listed = await (await handler(new Request('https://archive.test/api'))).json(); assert.equal(listed.files[0].name, 'STM32 datasheet.pdf');
  const downloaded = await handler(new Request(`https://archive.test/api?file=${encodeURIComponent(file.key)}&download=1`));
  assert.equal(downloaded.headers.get('content-type'), 'application/pdf');
  assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
  assert.equal(await downloaded.text(), '%PDF-1.7\nexample');
});
test('rejects renamed non-PDF content, oversized files and cross-origin upload', async () => {
  const { handler, blobs } = setup({ roles: ['admin'] });
  assert.equal((await handler(upload('bad.pdf', '<html>not a pdf</html>'))).status, 400);
  assert.equal((await handler(upload('big.pdf', '%PDF-' + 'x'.repeat(3 * 1024 * 1024)))).status, 413);
  assert.equal((await handler(upload('valid.pdf', '%PDF-1.7', 'https://untrusted.test'))).status, 403);
  assert.equal(blobs.size, 0);
});
test('missing and invalid document keys return appropriate errors', async () => {
  const { handler } = setup();
  assert.equal((await handler(new Request('https://archive.test/api?file=../../etc/passwd'))).status, 400);
  assert.equal((await handler(new Request('https://archive.test/api?file=pdf/00000000-0000-0000-0000-000000000000/missing.pdf'))).status, 404);
});
