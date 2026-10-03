import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
await mkdir('work/debug-tests', { recursive: true });
const modulePath = resolve('work/debug-tests/mock-sdk.mjs');
await writeFile(modulePath, `export const prepareFeedbackImage = file => globalThis.feedbackHarness.prepare(file); export class FeedbackClient { submitFeedback(input) { return globalThis.feedbackHarness.submit(input); } }`);
await build({ configFile: false, logLevel: 'silent', plugins: [react(), { name: 'test-sdk-import', enforce: 'pre', transform(code, id) { if (id.endsWith('/src/componentDebug.tsx')) return code.replace('const url = `${api}/v1/feedback/client.js?v=20261003-multiple-images`;', `const url = ${JSON.stringify(pathToFileURL(modulePath).href)};`); } }], build: { ssr: 'src/componentDebug.tsx', outDir: 'work/debug-tests', emptyOutDir: false } });

test('Debug includes current photo, supports optional extras, renews consent and preserves failures', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  for (const key of ['window', 'document', 'HTMLElement']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ComponentDebug } = await import('../work/debug-tests/componentDebug.js');
  const context = { componentType: 'resistor', bandCount: 4, colors: [], readings: [], scanStatus: 'unresolved', direction: { reason: 'invalid', preferred: false, reversed: null } };
  const current = new Blob(['current-frame'], { type: 'image/jpeg' });
  const prepared = [], uploads = [];
  let fail = true, wrongCount = false, captures = 0;
  globalThis.feedbackHarness = {
    async prepare(file) { prepared.push(file); if (file.type !== 'image/jpeg') throw Error('invalid'); return { base64: Buffer.from(await file.text()).toString('base64'), width: 120, height: 60, bytes: file.size }; },
    async submit(input) { uploads.push(input); if (fail) throw Error('offline'); return { id: 'synthetic-report', has_attachment: true, attachment_count: wrongCount ? 1 : input.images.length }; },
  };
  const root = createRoot(document.getElementById('root'));
  const toggle = () => document.querySelector('.scanner-debug > label input');
  const consent = () => document.querySelector('.debug-form input[type=checkbox]');
  const submit = () => document.querySelector('button.primary');
  const settle = async () => { for (let i = 0; i < 100 && (document.querySelector('[role=status]')?.textContent.includes('正在本机') || document.querySelector('button.primary')?.textContent.includes('正在提交')); i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); }); };
  const add = async files => { const input = document.querySelector('input[type=file]'); Object.defineProperty(input, 'files', { configurable: true, value: files }); await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))); await settle(); };
  try {
    await act(async () => root.render(createElement(ComponentDebug, { locale: 'zh', context, onOpen: async () => { captures++; return current; } })));
    await act(async () => toggle().click()); await settle();
    assert.equal(captures, 1); assert.equal(prepared[0], current);
    assert.equal(document.querySelectorAll('.debug-image').length, 1);
    assert.match(document.querySelector('figcaption').textContent, /当前扫描照片/);
    assert.equal(consent().checked, false); assert.equal(submit().disabled, true); assert.equal(uploads.length, 0);
    await act(async () => consent().click()); assert.equal(submit().disabled, false);
    await add([new Blob(['extra'], { type: 'image/jpeg' })]);
    assert.equal(document.querySelectorAll('.debug-image').length, 2);
    assert.equal(consent().checked, false, 'adding a preview renews consent');
    await add(Array.from({ length: 3 }, () => new Blob(['excess'], { type: 'image/jpeg' })));
    assert.equal(document.querySelectorAll('.debug-image').length, 2, 'oversized selection keeps existing photos');
    await act(async () => consent().click()); await act(async () => submit().click()); await settle();
    assert.match(document.querySelector('[role=status]').textContent, /提交未确认/);
    assert.equal(document.querySelectorAll('.debug-image').length, 2);
    assert.equal(uploads[0].images.length, 2); assert.equal(uploads[0].attachmentConsent, true);
    assert.deepEqual(JSON.parse(uploads[0].body).photos, ['current-scan', 'additional']);
    fail = false; wrongCount = true; await act(async () => submit().click()); await settle();
    assert.match(document.querySelector('[role=status]').textContent, /提交未确认/, 'partial receipt is not success');
    wrongCount = false; await act(async () => submit().click()); await settle();
    assert.match(document.querySelector('[role=status]').textContent, /synthetic-report/);
    assert.equal(document.querySelectorAll('.debug-image').length, 0);
    await act(async () => document.querySelector('.debug-form > button:last-child').click()); await settle();
    assert.equal(captures, 2); assert.equal(document.querySelectorAll('.debug-image').length, 1);
    await act(async () => consent().click()); await act(async () => document.querySelector('.debug-photo button').click());
    assert.equal(consent().checked, false); assert.equal(submit().disabled, true);
    await act(async () => root.unmount());
  } finally { dom.window.close(); delete globalThis.feedbackHarness; }
});
