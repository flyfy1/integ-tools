import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { tools } from '../src/tools.ts';
import { getDeveloperEngine } from '../src/engines/registry.ts';
import { locales } from '../src/i18n.ts';

await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/App.tsx', outDir: 'work/render-tests' } });
process.env.NODE_ENV = 'development';
const dom = new JSDOM('<div id="root"></div>', { url: 'https://tools.integ.life/en/' });
for (const key of ['window', 'document', 'location', 'history', 'localStorage', 'HTMLElement', 'PopStateEvent']) globalThis[key] = dom.window[key];
for (const key of ['addEventListener', 'removeEventListener', 'dispatchEvent']) globalThis[key] = dom.window[key].bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Match the production SDK: resource is getter-only and consumed on connection.
class IntegComments extends HTMLElement {
  get resource() { return this.getAttribute('resource') || location.pathname; }
  connectedCallback() { this.loadedResource = this.resource; this.loadedLanguage = this.lang; }
}
window.customElements.define('integ-comments', IntegComments);
const { createRoot } = await import('react-dom/client');
const { App } = await import('../work/render-tests/App.js');

async function navigate(path) {
  await act(async () => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); });
}

test('all localized routes mount with the already-loaded comments SDK', async () => {
  const failures = [];
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(App)));
    for (const locale of locales) {
      await navigate(`/${locale}/`);
      assert.equal(document.querySelectorAll('.catalog article').length, tools.length);
      for (const tool of tools) {
        await navigate(`/${locale}/${tool.slug}/`);
        assert.ok(document.querySelector('.workbench'), `${locale}/${tool.slug}: missing workbench`);
        const comments = document.querySelector('integ-comments');
        assert.equal(comments.loadedResource, `tool:${tool.slug}`);
        assert.equal(comments.loadedLanguage, locale);
        if (tool.kind === 'component-scanner') {
          assert.ok(document.querySelector('video[playsinline]'));
          assert.equal(document.querySelectorAll('.scanner-bands select').length, 4);
          assert.equal(document.querySelector('.scanner-reading strong'), null);
          continue;
        }
        if (tool.kind === 'qrcode') {
          assert.ok(document.querySelector('.qr-code-preview'), `${locale}/${tool.slug}: missing QR preview`);
          assert.equal(document.querySelector('.qr-status strong').textContent.length > 0, true);
          continue;
        }
        if (locale === 'en' && !tool.kind.startsWith('codex-')) {
          const engine = getDeveloperEngine(tool.kind);
          if (engine) assert.equal(document.querySelector('textarea').value, engine.example, `${tool.slug}: stale input`);
          const run = document.querySelector('.actions .primary');
          if (run) {
            await act(async () => run.click());
            // WebCrypto may complete after the click handler's first act flush.
            for (let attempt = 0; !document.querySelector('textarea[readonly]').value && attempt < 40; attempt++) {
              await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
            }
            const output = document.querySelector('textarea[readonly]').value;
            if (!output || /Error:|NaN|undefined/.test(output)) failures.push(`${tool.slug}: ${output}`);
          } else {
            assert.ok(document.querySelector('.result strong'));
            assert.doesNotMatch(document.querySelector('.result').textContent, /NaN|undefined/);
          }
        }
      }
    }
    await navigate('/en/pii-redactor/');
    await act(async () => document.querySelector('.actions .primary').click());
    const output = document.querySelector('textarea[readonly]').value;
    assert.ok(output.length > 0);
    assert.doesNotMatch(output, /ada@example\.com|192\.168\.1\.10|Error:/);
    assert.deepEqual(failures, []);
    // Changing language on the same tool must reconnect with translated labels.
    await navigate('/zh/pii-redactor/');
    assert.equal(document.querySelector('integ-comments').loadedLanguage, 'zh');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
