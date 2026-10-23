const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const publish = path.join(root, 'public');
const html = fs.readFileSync(path.join(publish, 'index.html'), 'utf8');

test('HTML page and document script have valid JavaScript syntax', () => {
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(inline.length > 0);
  inline.forEach((code, n) => assert.doesNotThrow(() => new vm.Script(code, { filename: `inline-${n}.js` })));
  const documents = fs.readFileSync(path.join(publish, 'assets/documents.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(documents, { filename: 'documents.js' }));
});

test('frontend assets exist in configured publish directory', () => {
  assert.match(html, /<html lang="tr">/);
  for (const match of html.matchAll(/<script\s+src="(\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(publish, match[1].slice(1))), `Missing asset: ${match[1]}`);
  }
});

test('site retains project filters, public documents, and reference color palette', () => {
  for (const name of ['project-list', 'tag-filters', 'platform', 'document-list', 'document-upload']) {
    assert.ok(html.includes(`id="${name}"`), `Missing element: ${name}`);
  }
  for (const color of ['--bg:#141414', '--bg-soft:#1b1b1b', '--surface:#202020']) {
    assert.ok(html.includes(color), `Missing palette token: ${color}`);
  }
  assert.ok(!html.includes('id="intro"'), 'Hero section should not return');
});

test('Netlify functions remain outside the public publish directory', () => {
  assert.ok(fs.existsSync(path.join(root, 'netlify/functions/documents.mts')));
  assert.equal(fs.existsSync(path.join(publish, 'netlify')), false);
});
