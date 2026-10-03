import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { bandColors, colorHex, decodeBands, assessBandDirection, detectBandStrip, formatComponentValue } from '../src/componentBands.ts';
import { BandConsensus, componentRegion, readComponentBands } from '../src/componentCapture.ts';
import { locateComponent, sampleComponentStrip } from '../src/componentLocator.ts';

function cameraFrame(colors, { width = 640, height = 360, cx = width / 2, cy = height / 2, length = 120, thickness = 36, angle = 0, body = '#d7bd96', positions } = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const radians = angle * Math.PI / 180;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x - cx) * Math.cos(radians) + (y - cy) * Math.sin(radians), v = -(x - cx) * Math.sin(radians) + (y - cy) * Math.cos(radians);
    let hex = '#a5aaa9';
    if (Math.abs(u) < length / 2 && Math.abs(v) < thickness / 2) {
      const band = colors.findIndex((_, i) => Math.abs(u / length + .5 - (positions?.[i] ?? (.12 + i * .76 / (colors.length - 1)))) < .025);
      hex = band < 0 ? body : colorHex[colors[band]];
    }
    for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = parseInt(hex.slice(1 + c * 2, 3 + c * 2), 16);
    data[(y * width + x) * 4 + 3] = 255;
  }
  return { data, width, height };
}

test('locates a small painted component away from the old scan line and follows modest tilt', () => {
  for (const pose of [{ cx: 145, cy: 95, length: 70, thickness: 22 }, { cx: 500, cy: 270, length: 100, thickness: 28, angle: 12 }]) {
    const colors = ['brown', 'black', 'red', 'gold'];
    const frame = cameraFrame(colors, pose);
    const target = locateComponent(frame.data, frame.width, frame.height);
    assert.ok(target, 'component must be located');
    assert.ok(Math.abs(target.cx - pose.cx) < 5);
    assert.ok(Math.abs(target.cy - pose.cy) < 5);
    assert.ok(Math.abs(target.length - pose.length) < 6);
    assert.deepEqual(detectBandStrip(sampleComponentStrip(frame.data, frame.width, frame.height, target), 420, 9, 4)?.map(b => b.color), colors);
  }
  const plain = cameraFrame([], { body: '#76b7cc' });
  assert.equal(locateComponent(plain.data, plain.width, plain.height), null, 'plain colored regions are not banded components');
});

// Controlled pixels test recognition and temporal behavior, not real optics.
function strip(colors, { noise = 0, body = '#d7bd96', palette = colorHex } = {}) {
  const width = 420, height = 9, data = new Uint8ClampedArray(width * height * 4);
  for (let x = 0; x < width; x++) {
    const band = colors.findIndex((_, i) => Math.abs(x / width - (.12 + i * .76 / (colors.length - 1))) < .025);
    const hex = band < 0 ? body : palette[colors[band]];
    for (let y = 0; y < height; y++) {
      for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = parseInt(hex.slice(1 + c * 2, 3 + c * 2), 16) + ((x + y) % 3 - 1) * noise;
      data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { data, width, height };
}
test('manufacturer reference codes, fractional multipliers, MIL decimals and units', () => {
  assert.equal(decodeBands(['green', 'blue', 'yellow', 'gold'], 'resistor')[0].value, 560000);
  assert.equal(decodeBands(['red', 'orange', 'violet', 'black', 'brown'], 'resistor')[0].value, 237);
  assert.equal(decodeBands(['green', 'blue', 'gold', 'gold'], 'resistor')[0].value, 5.6);
  assert.equal(decodeBands(['red', 'violet', 'brown', 'gold'], 'inductor')[0].value, 270);
  assert.equal(decodeBands(['blue', 'grey', 'gold', 'silver'], 'inductor')[0].value, 6.8);
  assert.equal(decodeBands(['silver', 'blue', 'gold', 'grey', 'silver'], 'inductor-mil')[0].value, 6.8);
  assert.equal(decodeBands(['silver', 'gold', 'blue', 'grey', 'gold'], 'inductor-mil')[0].value, .68);
  assert.equal(decodeBands(['silver', 'red', 'violet', 'brown', 'gold'], 'inductor-mil')[0].value, 270);
  assert.equal(formatComponentValue(4700, 'resistor'), '4.7 kΩ');
  assert.equal(formatComponentValue(4700, 'inductor'), '4.7 mH');
  assert.equal(formatComponentValue(.47, 'inductor'), '0.47 µH');
});
test('rejects unsupported codes and retains ambiguous reading directions', () => {
  assert.deepEqual(decodeBands(['black', 'red', 'brown', 'gold'], 'resistor'), []);
  assert.deepEqual(decodeBands(['brown', 'gold', 'red', 'gold'], 'resistor'), []);
  assert.deepEqual(decodeBands(['brown', 'black', 'red', 'brown'], 'inductor'), []);
  assert.deepEqual(decodeBands(['red', 'red', 'red', 'red', 'red', 'red'], 'resistor'), []);
  assert.deepEqual(decodeBands(['gold', 'red', 'black', 'brown'], 'resistor').map(r => [r.value, r.reversed]), [[1000, true]]);
  assert.equal(decodeBands(['brown', 'black', 'red', 'brown'], 'resistor').length, 2);
});
test('direction inference uses metallic ends and clear end spacing without hiding ambiguity', () => {
  const geometry = xs => xs.map(x => ({ x, width: .05 }));
  const colors = ['red', 'red', 'black', 'black', 'brown'];
  const positions = [.15, .27, .39, .51, .76];
  const forward = assessBandDirection(colors, 'resistor', geometry(positions));
  assert.equal(forward.reason, 'spacing'); assert.equal(forward.preferred, true);
  assert.equal(forward.readings[0].value, 220); assert.equal(forward.readings[0].reversed, false);
  assert.equal(forward.readings.length, 2, 'retain the other valid direction');
  const backward = assessBandDirection([...colors].reverse(), 'resistor', geometry(positions.map(x => 1 - x).reverse()));
  assert.equal(backward.reason, 'spacing'); assert.equal(backward.readings[0].value, 220);
  assert.equal(backward.readings[0].reversed, true);
  for (const end of ['gold', 'silver']) {
    const metallic = assessBandDirection([end, 'red', 'black', 'brown'], 'resistor');
    assert.equal(metallic.reason, 'metallic'); assert.equal(metallic.readings[0].reversed, true);
    assert.equal(metallic.readings[0].value, 1000);
  }
  for (const pixels of [[], geometry([.1, .3, .5, .7, .9]), geometry([.1, .31, .51, .71, .9]), geometry([.1, .2, .3, .4]), geometry([NaN, .27, .39, .51, .76])]) {
    const uncertain = assessBandDirection(colors, 'resistor', pixels);
    assert.equal(uncertain.preferred, false); assert.equal(uncertain.reason, 'ambiguous');
    assert.equal(uncertain.readings.length, 2);
  }
  assert.equal(assessBandDirection(['orange', 'orange', 'black', 'black', 'brown'], 'resistor').reason, 'code');
  assert.equal(assessBandDirection(['brown', 'brown', 'brown', 'brown'], 'resistor').reason, 'ambiguous', 'identical values do not establish a direction');
  const wide = geometry([.1, .2, .3, .5]); wide[3].width = .3;
  assert.equal(assessBandDirection(['brown', 'black', 'red', 'brown'], 'resistor', wide).reason, 'ambiguous', 'wide bands must not fake a clear end gap');
  const conflict = assessBandDirection(['brown', 'black', 'red', 'gold'], 'resistor', geometry([.1, .45, .6, .75]));
  assert.equal(conflict.reason, 'conflict'); assert.equal(conflict.preferred, false);
  assert.equal(assessBandDirection(['red', 'red', 'red'], 'resistor').reason, 'invalid');
  assert.equal(assessBandDirection(['silver', 'blue', 'gold', 'grey', 'silver'], 'inductor-mil', geometry(positions)).reason, 'ambiguous', 'resistor spacing must not reinterpret a MIL ID band');
});

test('pixel recognition tolerates small noise but rejects blank and wrong band count', () => {
  for (const colors of [['brown', 'black', 'red', 'gold'], ['yellow', 'violet', 'orange', 'gold'], ['red', 'orange', 'violet', 'black', 'brown'], ['silver', 'blue', 'gold', 'grey', 'silver']]) {
    const image = strip(colors, { noise: 3 });
    assert.deepEqual(detectBandStrip(image.data, image.width, image.height, colors.length)?.map(b => b.color), colors);
  }
  const blank = strip([]);
  assert.equal(detectBandStrip(blank.data, blank.width, blank.height, 4), null);
  const wrong = strip(['brown', 'black', 'red', 'gold']);
  assert.equal(detectBandStrip(wrong.data, wrong.width, wrong.height, 5), null);
  assert.equal(detectBandStrip(new Uint8ClampedArray(1), 420, 9, 4), null);
});

test('dim colored bands on a blue body preserve five-band nominal decoding and flag uncertainty', () => {
  const colors = ['red', 'red', 'black', 'black', 'blue'];
  const image = strip(colors, { body: '#70aac4', palette: { red: '#54333a', black: '#192a39', blue: '#24324b' }, noise: 1 });
  assert.equal(detectBandStrip(image.data, image.width, image.height, 4), null);
  const found = detectBandStrip(image.data, image.width, image.height, 5);
  assert.deepEqual(found?.map(b => b.color), colors);
  assert.equal(decodeBands(found.map(b => b.color), 'resistor')[0].value, 220);
  assert.equal(found.at(-1).uncertain, true, 'dim tolerance color must be reviewable');
});

await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/componentScanner.tsx', outDir: 'work/scanner-tests' } });
test('camera loop stabilizes, clears old values, pauses, handles denial and releases late streams', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://tools.integ.life/zh/component-scanner/' });
  for (const key of ['window', 'document', 'HTMLElement', 'DOMException']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const { createRoot } = await import('react-dom/client');
  const { ComponentScanner } = await import('../work/scanner-tests/componentScanner.js');
  let frame = cameraFrame(['brown', 'black', 'red', 'gold']);
  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    const canvas = this;
    return { drawImage() {}, getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
        const px = Math.min(frame.width - 1, Math.floor((x + dx) * frame.width / canvas.width));
        const py = Math.min(frame.height - 1, Math.floor((y + dy) * frame.height / canvas.height));
        data.set(frame.data.subarray((py * frame.width + px) * 4, (py * frame.width + px) * 4 + 4), (dy * width + dx) * 4);
      }
      return { data, width, height };
    } };
  };
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  for (const [key, value] of [['videoWidth', 1000], ['videoHeight', 562], ['readyState', 4]]) Object.defineProperty(dom.window.HTMLVideoElement.prototype, key, { get: () => value });
  let stops = 0, opens = 0;
  const track = { stop: () => { stops++; }, onended: null };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async constraints => { opens++; assert.equal(constraints.audio, false); assert.equal(constraints.video.facingMode.ideal, 'environment'); return stream; } } });
  const root = createRoot(document.getElementById('root'));
  const start = () => document.querySelector('.actions button');
  const wait = ms => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
  try {
    await act(async () => root.render(createElement(ComponentScanner, { locale: 'zh' })));
    assert.equal(document.querySelector('.scanner-reading strong'), null);
    await act(async () => start().click());
    await wait(550);
    assert.equal(document.querySelector('.scanner-reading strong'), null);
    await act(async () => start().click());
    assert.match(document.querySelector('.scanner-reading').textContent, /1 kΩ/, 'pause reads the first localized frame before temporal stability');
    assert.equal(stops, 1);
    await act(async () => start().click());
    await wait(1500);
    assert.match(document.querySelector('.scanner-reading').textContent, /1 kΩ/);
    frame = cameraFrame([]);
    await wait(500);
    assert.equal(document.querySelector('.scanner-reading strong'), null, 'old result must clear');
    frame = cameraFrame(['yellow', 'violet', 'orange', 'gold'], { cx: 465, cy: 100 });
    await wait(1500);
    assert.match(document.querySelector('.scanner-reading').textContent, /47 kΩ/);
    frame = cameraFrame(['red', 'red', 'black', 'black', 'blue'], { cx: 200, cy: 270, length: 100, thickness: 25, body: '#70aac4', positions: [.15, .27, .39, .51, .76] });
    await wait(1500);
    assert.equal(document.querySelectorAll('.scanner-bands select').length, 5, 'live camera detects band count');
    assert.match(document.querySelector('.scanner-reading').textContent, /220 Ω/);
    assert.equal(opens, 2, 'automatic count must not reopen the camera');
    assert.match(document.querySelector('.scanner-direction-note').textContent, /右端色环/);
    assert.match(document.querySelector('.scanner-preferred').textContent, /优先候选/);
    assert.match(document.querySelector('.scanner-reading > .scanner-candidate').textContent, /220 Ω/);
    assert.equal(document.querySelector('.scanner-alternatives').open, false);
    assert.match(document.querySelector('.scanner-bands label:last-child').textContent, /容差环候选/);
    await act(async () => document.querySelector('.scanner-alternatives summary').click());
    assert.match(document.querySelector('.scanner-alternatives').textContent, /60 kΩ/);
    frame = cameraFrame(['blue', 'black', 'black', 'red', 'red'], { cx: 200, cy: 270, length: 100, thickness: 25, body: '#70aac4', positions: [.24, .49, .61, .73, .85] });
    await wait(1500);
    assert.match(document.querySelector('.scanner-reading > .scanner-candidate').textContent, /220 Ω.*从右向左读/);
    assert.match(document.querySelector('.scanner-direction-note').textContent, /左端色环/);
    assert.match(document.querySelector('.scanner-bands label:first-child').textContent, /容差环候选/);
    frame = cameraFrame(['yellow', 'violet', 'orange', 'gold'], { cx: 465, cy: 100 });
    await wait(1500);
    assert.equal(document.querySelectorAll('.scanner-bands select').length, 4);
    await act(async () => start().click());
    assert.equal(stops, 2);
    assert.equal(document.querySelector('video').srcObject, null);
    assert.match(document.querySelector('[role="status"]').textContent, /已暂停/);
    const select = document.querySelector('.scanner-bands select');
    await act(async () => { select.value = 'red'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('.scanner-reading').textContent, /27 kΩ/);
    await act(async () => document.querySelector('.component-scanner > button').click());
    assert.match(document.querySelector('.scanner-reading > .scanner-candidate').textContent, /27 kΩ.*从右向左读/);
    assert.match(document.querySelector('.scanner-bands label:first-child').textContent, /容差环候选/);
    const exampleSelect = document.querySelector('.guide-example-select select');
    await act(async () => { exampleSelect.value = '4'; exampleSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('.guide-example-result').textContent, /6.8 µH ±10%/);
    await act(async () => document.querySelector('.component-guide button').click());
    assert.equal(document.querySelector('.scanner-options select').value, 'inductor-mil');
    assert.equal(document.querySelectorAll('.scanner-bands select').length, 5);
    assert.match(document.querySelector('.scanner-reading').textContent, /6.8 µH/);
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
    await act(async () => start().click());
    assert.match(document.querySelector('[role="status"]').textContent, /权限被拒绝/);
    assert.equal(document.querySelector('.scanner-reading strong'), null);
    let resolveStream;
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveStream = resolve; });
    await act(async () => start().click());
    await act(async () => root.unmount());
    await act(async () => resolveStream(stream));
    assert.equal(stops, 3, 'late permission result must stop after unmount');
  } finally { dom.window.close(); }
});

 test('native source bands survive a small localization frame and warning jitter', () => {
  const colors = ['brown', 'black', 'red', 'gold'];
  const frame = cameraFrame(colors, { width: 1920, height: 1080, length: 108, thickness: 30 });
  const target = { cx: 320, cy: 180, length: 36, thickness: 10, angle: 0, box: { x: 302 / 640, y: 175 / 360, width: 36 / 640, height: 10 / 360 } };
  assert.equal(readComponentBands(frame.data, 1920, 1080, target, 'resistor'), null);
  const region = componentRegion(target, 640, 360, 1920, 1080);
  const scaled = { ...region.target, cx: region.target.cx + region.x, cy: region.target.cy + region.y };
  const bands = readComponentBands(frame.data, 1920, 1080, scaled, 'resistor');
  assert.deepEqual(bands?.map(b => b.color), colors);
  const consensus = new BandConsensus();
  assert.equal(consensus.add(bands), null);
  assert.equal(consensus.add(bands.map(b => ({ ...b, uncertain: true }))), null);
  assert.equal(consensus.add(null), null);
  assert.deepEqual(consensus.add(bands)?.map(b => b.color), colors);
  consensus.reset(); assert.equal(consensus.add(bands), null);
});
 test('off-center strips recover bands when the center is obscured by glare', () => {
  const frame = cameraFrame(['brown', 'black', 'red', 'gold']);
  for (let y = 176; y <= 184; y++) for (let x = 260; x < 380; x++) frame.data.set([245, 245, 245, 255], (y * frame.width + x) * 4);
  const target = { cx: 320, cy: 180, length: 120, thickness: 36, angle: 0, box: { x: 260 / 640, y: 162 / 360, width: 120 / 640, height: 36 / 360 } };
  assert.equal(detectBandStrip(sampleComponentStrip(frame.data, frame.width, frame.height, target), 420, 9, 4), null);
  assert.deepEqual(readComponentBands(frame.data, frame.width, frame.height, target, 'resistor')?.map(b => b.color), ['brown', 'black', 'red', 'gold']);
});
