import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { JSDOM } from 'jsdom';

await build({ configFile: false, logLevel: 'silent', build: { ssr: 'src/analytics.ts', outDir: 'work/analytics-tests' } });
const { startAnalytics, analyticsPath } = await import('../work/analytics-tests/analytics.js');
const views = win => win.dataLayer.map(value => Array.from(value)).filter(value => value[0] === 'event');

test('only production top-level pages load analytics once', () => {
  for (const host of ['localhost', 'preview.example.com']) {
    const { window } = new JSDOM('', { url: `https://${host}/en/` });
    startAnalytics(window);
    assert.equal(window.dataLayer, undefined);
    assert.equal(window.document.scripts.length, 0);
    window.close();
  }
  const { window } = new JSDOM('', { url: 'https://tools.integ.life/en/' });
  startAnalytics(window);
  startAnalytics(window);
  assert.equal(window.document.scripts.length, 1);
  assert.equal(views(window).length, 1);
  assert.equal(views(window)[0][2].send_to, 'G-G9R5B7MNQX');
  window.close();
});

test('history navigation counts once and excludes private URL data and titles', () => {
  const { window } = new JSDOM('<title>PRIVATE_TITLE</title>', { url: 'https://tools.integ.life/en/?q=PRIVATE_INPUT#PRIVATE_FRAGMENT' });
  startAnalytics(window);
  window.history.pushState({}, '', '/zh/?q=PRIVATE_QUERY');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  window.history.replaceState({}, '', '/zh/?q=PRIVATE_REPLACEMENT');
  window.history.pushState({}, '', '/unknown/PRIVATE_PATH');
  assert.deepEqual(views(window).map(value => value[2].page_location), [
    'https://tools.integ.life/en/', 'https://tools.integ.life/zh/', 'https://tools.integ.life/not-found',
  ]);
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /PRIVATE_/);
  assert.equal(analyticsPath('/en'), '/en/');
  assert.equal(analyticsPath('/en/unknown-tool/'), '/not-found');
  window.close();
});
