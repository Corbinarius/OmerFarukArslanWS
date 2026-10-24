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
  for (const filename of ['documents.js', 'projects.js', 'project-upload.js', 'source-browser.js', 'site-shell.js']) {
    const code = fs.readFileSync(path.join(publish, 'assets', filename), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename }));
  }
});

test('frontend assets exist in configured publish directory', () => {
  assert.match(html, /<html lang="tr">/);
  for (const match of html.matchAll(/<script\s+src="(\/[^"]+)"/g)) {
    if (match[1] === '/assets/identity-client.js') {
      assert.ok(fs.existsSync(path.join(root, 'src/identity-client.mjs')), 'Missing Identity build entry');
    } else assert.ok(fs.existsSync(path.join(publish, match[1].slice(1))), `Missing asset: ${match[1]}`);
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

test('project publisher offers a secure management interface and Netlify backend', () => {
  for (const id of ['open-project-manager','project-manager','project-admin-login','project-publish-form','new-project-title','new-project-platform','new-project-color','new-project-tags','new-project-sources','new-project-folder','source-selection','new-project-repo','delete-current-project']) {
    assert.ok(html.includes(`id="${id}"`), `Missing project control: ${id}`);
  }
  const api = fs.readFileSync(path.join(root, 'netlify/functions/projects.mts'),'utf8');
  assert.ok(api.includes('verifyRequestOrigin(request)'));
  assert.ok(api.includes("user.roles?.includes('admin')"));
  assert.ok(api.includes("getStore({ name: 'portfolio-projects'"));
  assert.ok(api.includes('sources/${id}/${index}'));
  assert.ok(api.includes('sourceFiles: sourceManifest'));
  assert.ok(html.includes('fileTreeMarkup(project.sourceFiles)'));
});

test('static demonstration projects are removed while dynamic project publishing remains enabled', () => {
  assert.match(html, /const PROJECTS = \[\];/);
  assert.doesNotMatch(html, /\{id:'gpio-led'/);
  assert.match(html, /Henüz proje yayımlanmadı/);
  const publisher = fs.readFileSync(path.join(publish, 'assets', 'projects.js'), 'utf8');
  assert.match(publisher, /async function loadProjects\(/);
  assert.match(publisher, /PROJECTS\.unshift\(\.\.\.verified\)/);
});
