import { useEffect, useRef, useState } from 'react';
import type { Locale } from './i18n';
import { bandColors, colorHex, decodeBands, detectBandStrip, formatComponentValue, type BandColor, type ComponentType, type DetectedBand } from './componentBands';
import './componentScanner.css';
import { ComponentDebug } from './componentDebug';

const text = {
  en: {
    type: 'Component type', resistor: 'Resistor', inductor: 'Inductor · EIA', mil: 'Inductor · MIL (wide silver first band)', count: 'Number of bands',
    start: 'Start rear camera', stop: 'Pause & correct', starting: 'Opening camera…', guide: 'Place one component horizontally. Fill the guide with its body, with all bands visible. Use diffuse daylight and avoid glare.',
    idle: 'Camera is off. Start scanning or enter the colors below.', seeking: 'Looking for clear, consistent bands…', candidate: 'Camera candidate · verify colors', paused: 'Paused camera candidate · verify colors', manual: 'Manually entered colors',
    empty: 'No value yet', invalid: 'This color sequence is not a supported code. Check colors, band count and component type.', ambiguous: 'Both reading directions are valid. Check which end has the tolerance band; both candidates are shown.',
    band: 'Band', unknown: 'Choose color', reverse: 'Reverse colors', correction: 'Detected colors, left to right. Pause before correcting.',
    limit: 'Reads nominal values from color bands, not an electrical measurement. Component type must be selected: appearance alone cannot reliably distinguish resistors and inductors. Supports 4/5-band resistors, 4-band EIA inductors and 5-band MIL inductors. SMD text codes, 6-band resistors and unmarked parts are not scanned.',
    verify: 'Experimental camera reader. Shadows, body paint and metallic bands can change the reading. Check the displayed colors and confirm critical values with a meter.',
    privacy: 'Scanning stays on this device. Debug lets you explicitly upload a selected image.', permission: 'Camera permission was denied. Allow camera access in your browser settings, then retry. Manual color entry also works.',
    unavailable: 'Camera unavailable. Use HTTPS and a browser with camera access, or enter colors manually.', busy: 'The camera could not start. Close other camera apps and retry.', ended: 'Camera stopped. Restart to scan another component.', direction: 'Read right to left', forward: 'Read left to right',
    colors: ['Black', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet', 'Grey', 'White', 'Gold', 'Silver'],
  },
  zh: {
    type: '元件类型', resistor: '电阻', inductor: '电感 · EIA', mil: '电感 · MIL（首环为宽银环）', count: '色环数量',
    start: '打开后置摄像头', stop: '暂停并修正', starting: '正在打开摄像头…', guide: '将单个元件横放，让主体填满框内，全部色环清晰可见。使用均匀自然光，避开反光。',
    idle: '摄像头已关闭。可以开始扫描，也可以在下方手动选择颜色。', seeking: '正在寻找清晰且连续一致的色环…', candidate: '摄像头候选结果 · 请核对颜色', paused: '已暂停的摄像头候选结果 · 请核对颜色', manual: '手动输入的色环',
    empty: '还没有读数', invalid: '这个颜色顺序不符合已支持的编码，请检查颜色、色环数量和元件类型。', ambiguous: '两个读向都符合编码，请核对容差环在哪一端。下方显示两种候选结果。',
    band: '色环', unknown: '选择颜色', reverse: '反转色环顺序', correction: '下方按画面从左到右显示色环，暂停后可以修正。',
    limit: '读取色环标示的标称值，不是电气测量。请先选择元件类型，单靠外观无法可靠区分电阻和电感。支持 4/5 环电阻、4 环 EIA 电感和 5 环 MIL 电感，暂不扫描贴片文字编码、6 环电阻或无标记元件。',
    verify: '实验版摄像头识别。阴影、主体底色和金属色环可能造成误读，请核对显示的颜色，关键数值用仪表确认。',
    privacy: '扫描画面只在本机处理。Debug 可由你主动上传选定图片。', permission: '摄像头权限被拒绝。请在浏览器设置中允许访问后重试，也可以手动输入色环。',
    unavailable: '摄像头不可用，请使用 HTTPS 和支持摄像头的浏览器，也可以手动输入色环。', busy: '无法启动摄像头，请关闭其他使用摄像头的应用后重试。', ended: '摄像头已停止，重新打开即可扫描下一个元件。', direction: '从右向左读', forward: '从左向右读',
    colors: ['黑', '棕', '红', '橙', '黄', '绿', '蓝', '紫', '灰', '白', '金', '银'],
  },
};

export function ComponentScanner({ locale }: { locale: Locale }) {
  const t = text[locale === 'zh' ? 'zh' : 'en'];
  const video = useRef<HTMLVideoElement>(null);
  const [type, setType] = useState<ComponentType>('resistor');
  const [count, setCount] = useState(4);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<keyof Omit<typeof text.en, 'colors'> >('idle');
  const [bands, setBands] = useState<DetectedBand[]>([]);
  const [manualBands, setManualBands] = useState<string[]>(Array(4).fill(''));
  const [manual, setManual] = useState(false);
  const colors = manual ? manualBands : bands.map(b => b.color);
  const complete = colors.length === count && colors.every(c => bandColors.includes(c as BandColor));
  const readings = complete ? decodeBands(colors as BandColor[], type) : [];

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastKey = '', streak = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 420; canvas.height = 9;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pauseOnHide = () => { if (document.hidden) { setEnabled(false); setStatus('ended'); } };
    document.addEventListener('visibilitychange', pauseOnHide);
    const open = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context) { setStatus('unavailable'); setEnabled(false); return; }
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getVideoTracks().forEach(track => { track.onended = () => { setEnabled(false); setStatus('ended'); }; });
        const player = video.current;
        if (!player) { stream.getTracks().forEach(track => track.stop()); return; }
        player.srcObject = stream;
        await player.play();
        if (cancelled) return;
        setStatus('seeking');
        timer = setInterval(() => {
          if (player.readyState < 2 || !player.videoWidth) return;
          // The guide is 76% of the uncropped video width and 6% of its height.
          context.drawImage(player, player.videoWidth * .12, player.videoHeight * .47, player.videoWidth * .76, player.videoHeight * .06, 0, 0, 420, 9);
          const found = detectBandStrip(context.getImageData(0, 0, 420, 9).data, 420, 9, count);
          const key = found?.map(b => b.color).join(',') || '';
          streak = key && key === lastKey ? streak + 1 : 1;
          lastKey = key;
          if (!found || streak < 3) { setBands([]); setStatus('seeking'); return; }
          setBands(found);
          setStatus('candidate');
        }, 450);
      } catch (error) {
        if (cancelled) return;
        stream?.getTracks().forEach(track => track.stop());
        setBands([]);
        setStatus(error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name) ? 'permission' : 'busy');
        setEnabled(false);
      }
    };
    void open();
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', pauseOnHide);
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      if (video.current) video.current.srcObject = null;
    };
  }, [enabled, count]);

  const reset = (nextType: ComponentType, nextCount: number) => {
    setType(nextType); setCount(nextCount); setBands([]); setManualBands(Array(nextCount).fill('')); setManual(false); setStatus('idle');
  };
  const edit = (index: number, color: string) => {
    const next = Array.from({ length: count }, (_, i) => colors[i] || '');
    next[index] = color; setManualBands(next); setManual(true); setStatus('manual');
  };

  return <section className="workbench component-scanner">
    <div className="work-head"><b>{t.privacy}</b></div>
    <div className="scanner-options">
      <label>{t.type}<select disabled={enabled} value={type} onChange={e => { const next = e.target.value as ComponentType; reset(next, next === 'inductor-mil' ? 5 : 4); }}>
        <option value="resistor">{t.resistor}</option><option value="inductor">{t.inductor}</option><option value="inductor-mil">{t.mil}</option>
      </select></label>
      <label>{t.count}<select disabled={enabled || type !== 'resistor'} value={count} onChange={e => reset(type, Number(e.target.value))}><option value="4">4</option><option value="5">5</option></select></label>
    </div>
    <p>{t.guide}</p>
    <div className="scanner-view">
      <video ref={video} autoPlay muted playsInline aria-label={t.guide}/>
      <div className="scanner-guide" aria-hidden="true">{enabled && bands.map((b, i) => <i key={i} style={{ left: `${b.x * 100}%`, backgroundColor: colorHex[b.color] }}>{i + 1}</i>)}</div>
    </div>
    <div className="actions">
      <button className="primary" onClick={() => {
        if (enabled) { setEnabled(false); setStatus(bands.length ? 'paused' : 'idle'); }
        else { setBands([]); setManual(false); setStatus('starting'); setEnabled(true); }
      }}>{enabled ? t.stop : t.start}</button>
    </div>
    <p role="status">{t[status]}</p>
    <div className="scanner-reading" aria-live="polite">
      {readings.length ? <>{readings.length > 1 && <p>{t.ambiguous}</p>}{readings.map((r, i) => <div key={i}><strong>{formatComponentValue(r.value, type)} <small>±{r.tolerance}%</small></strong><span>{r.reversed ? t.direction : t.forward}</span></div>)}<p>{t.verify}</p></> : <p>{complete ? t.invalid : t.empty}</p>}
    </div>
    <p>{t.correction}</p>
    <div className="scanner-bands">{Array.from({ length: count }, (_, i) => <label key={i}>
      {t.band} {i + 1}<span className="scanner-swatch" style={{ backgroundColor: colors[i] ? colorHex[colors[i] as BandColor] : 'transparent' }}/>
      <select aria-label={`${t.band} ${i + 1}`} disabled={enabled} value={colors[i] || ''} onChange={e => edit(i, e.target.value)}><option value="">{t.unknown}</option>{bandColors.map((c, index) => <option key={c} value={c}>{t.colors[index]}</option>)}</select>
    </label>)}</div>
    <button disabled={enabled || !colors.some(Boolean)} onClick={() => { setManualBands([...colors].reverse()); setManual(true); setStatus('manual'); }}>{t.reverse}</button>
    <p className="note">{t.limit}</p>
    <ComponentDebug locale={locale} context={{ componentType: type, bandCount: count, colors, readings: readings.map(r => ({ value: r.value, tolerance: r.tolerance })), scanStatus: status }} onOpen={() => { setEnabled(false); if (enabled) setStatus(bands.length ? 'paused' : 'idle'); }}/>
    <div className="scanner-sources"><a href="https://www.vishay.com/docs/49411/resistor_color_code_calculator.pdf" target="_blank" rel="noreferrer">Vishay · resistor codes</a><a href="https://www.bourns.com/docs/technical-documents/technical-library/inductive-components/publications/ColorCodeMarkings.pdf" target="_blank" rel="noreferrer">Bourns · inductor codes</a></div>
  </section>;
}
