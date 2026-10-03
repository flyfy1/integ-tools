import { useEffect, useRef, useState } from 'react';
import type { Locale } from './i18n';
import { bandColors, colorHex, assessBandDirection, formatComponentValue, type BandColor, type BandReading, type ComponentType, type DetectedBand } from './componentBands';
import './componentScanner.css';
import { ComponentDebug } from './componentDebug';
import { ComponentGuide } from './componentGuide';
import { BandConsensus, componentRegion, readComponentBands } from './componentCapture';
import { locateComponent, type ComponentTarget } from './componentLocator';

const text = {
  en: {
    type: 'Component type', resistor: 'Resistor', inductor: 'Inductor · EIA', mil: 'Inductor · MIL (wide silver first band)', count: 'Number of bands',
    reviewTitle: 'Review reading', cameraOff: 'Camera off', confirm: 'Confirm colors', confirmed: 'Colors checked', rescan: 'Scan again', correct: 'Correct colors', evidence: 'Direction & reading details', captured: 'Stable candidate captured · camera is off. Verify the colors.', pausedEmpty: 'Photo retained, but no bands were read. Correct colors or report this photo.', start: 'Start rear camera', stop: 'Use this frame', starting: 'Opening camera…', guide: 'Hold one component roughly horizontal near the middle; it need not fill the frame. Keep bands in focus. A stable reading stops the camera automatically.',
    idle: 'Camera is off. Start scanning or enter the colors below.', seeking: 'Looking for clear, consistent bands…', candidate: 'Camera candidate · verify colors', paused: 'Paused camera candidate · verify colors', manual: 'Manually entered colors',
    unresolved: 'Component located, but its bands are not resolved. Inspect the magnified photo, correct colors or report this frame.', empty: 'No value yet', invalid: 'This color sequence is not a supported code. Check colors, band count and component type.', ambiguous: 'Both reading directions are valid. Check which end has the tolerance band; both candidates are shown.',
    band: 'Band', unknown: 'Choose color', reverse: 'Reverse colors', correction: 'Detected colors, left to right. Pause before correcting.',
    limit: 'Reads nominal values from color bands, not an electrical measurement. Component type must be selected: appearance alone cannot reliably distinguish resistors and inductors. Supports 4/5-band resistors, 4-band EIA inductors and 5-band MIL inductors. SMD text codes, 6-band resistors and unmarked parts are not scanned.',
    verify: 'Experimental camera reader. Shadows, body paint and metallic bands can change the reading. Check the displayed colors and confirm critical values with a meter.',
    privacy: 'Scanning stays on this device. Debug previews the current photo for an explicit report submission.', permission: 'Camera permission was denied. Allow camera access in your browser settings, then retry. Manual color entry also works.',
    unavailable: 'Camera unavailable. Use HTTPS and a browser with camera access, or enter colors manually.', busy: 'The camera could not start. Close other camera apps and retry.', ended: 'Camera stopped. Restart to scan another component.', direction: 'Read right to left', forward: 'Read left to right',
    colors: ['Black', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet', 'Grey', 'White', 'Gold', 'Silver'],
    located: 'Component candidate located · waiting for clear, consistent bands', small: 'Component candidate located · move a little closer or improve focus to resolve its bands', placement: 'Place one component here · the detection box follows it', zoom: 'Located component · local magnified view', autoCount: 'Camera scanning detects 4 or 5 resistor bands automatically.', uncertain: 'Bands marked † need checking against the photo. An uncertain tolerance is not shown as a percentage.', checkColor: 'Verify color', checkTolerance: 'tolerance unconfirmed', preferred: 'Preferred candidate', alternatives: 'Other reading direction · verify if needed', toleranceBand: 'Tolerance band candidate', metallic: 'The gold/silver end band cannot be a leading digit: read from the opposite end.', code: 'Only this direction matches the selected color code. Verify the colors.', spacing: 'The {end} end band has a larger gap. Treating it as the tolerance band favors this direction; spacing is a clue, not proof.', left: 'left', right: 'right', conflict: 'Spacing and the selected color code suggest different directions. Check the colors or confirm with a meter.',
  },
  zh: {
    type: '元件类型', resistor: '电阻', inductor: '电感 · EIA', mil: '电感 · MIL（首环为宽银环）', count: '色环数量',
    reviewTitle: '核对识别结果', cameraOff: '摄像头已关闭', confirm: '确认色环', confirmed: '已核对色环', rescan: '重新扫描', correct: '修正颜色', evidence: '读向与识别说明', captured: '已取得稳定候选值，摄像头已关闭。请核对色环。', pausedEmpty: '画面已保留，暂未读出色环。可修正颜色或报告当前照片。', start: '打开后置摄像头', stop: '使用当前画面', starting: '正在打开摄像头…', guide: '元件横放在画面中部附近，无需占满框。保持色环对焦清晰，稳定读数后会自动关闭摄像头。',
    idle: '摄像头已关闭。可以开始扫描，也可以在下方手动选择颜色。', seeking: '正在寻找清晰且连续一致的色环…', candidate: '摄像头候选结果 · 请核对颜色', paused: '已暂停的摄像头候选结果 · 请核对颜色', manual: '手动输入的色环',
    unresolved: '已定位元件，但还没分清全部色环。请核对局部放大图、修正颜色，或直接报告当前照片。', empty: '还没有读数', invalid: '这个颜色顺序不符合已支持的编码，请检查颜色、色环数量和元件类型。', ambiguous: '两个读向都符合编码，请核对容差环在哪一端。下方显示两种候选结果。',
    band: '色环', unknown: '选择颜色', reverse: '反转色环顺序', correction: '下方按画面从左到右显示色环，暂停后可以修正。',
    limit: '读取色环标示的标称值，不是电气测量。请先选择元件类型，单靠外观无法可靠区分电阻和电感。支持 4/5 环电阻、4 环 EIA 电感和 5 环 MIL 电感，暂不扫描贴片文字编码、6 环电阻或无标记元件。',
    verify: '实验版摄像头识别。阴影、主体底色和金属色环可能造成误读，请核对显示的颜色，关键数值用仪表确认。',
    privacy: '扫描画面只在本机处理。Debug 会预览当前照片，由你主动提交报告。', permission: '摄像头权限被拒绝。请在浏览器设置中允许访问后重试，也可以手动输入色环。',
    unavailable: '摄像头不可用，请使用 HTTPS 和支持摄像头的浏览器，也可以手动输入色环。', busy: '无法启动摄像头，请关闭其他使用摄像头的应用后重试。', ended: '摄像头已停止，重新打开即可扫描下一个元件。', direction: '从右向左读', forward: '从左向右读',
    colors: ['黑', '棕', '红', '橙', '黄', '绿', '蓝', '紫', '灰', '白', '金', '银'],
    located: '已定位疑似元件 · 等待清晰且连续一致的色环', small: '已定位疑似元件 · 请稍微靠近或改善对焦，让色环可分辨', placement: '单个元件放在此区域附近 · 定位框会跟随', zoom: '已定位元件 · 本机局部放大', autoCount: '扫描时自动判断电阻的 4 / 5 条色环。', uncertain: '标记 † 的色环请对照照片核对；容差未明确时不显示百分比。', checkColor: '颜色待核对', checkTolerance: '容差待核对', preferred: '优先候选', alternatives: '另一读向候选 · 需要时展开核对', toleranceBand: '容差环候选', metallic: '末端金 / 银环不能作为开头的数字环，优先从另一端开始读。', code: '当前颜色只有这个读向符合编码，请核对色环颜色。', spacing: '{end}端色环与其他环间隔更大，优先将其作为容差环按此方向读；间距是线索，并非绝对保证。', left: '左', right: '右', conflict: '色环间距与当前颜色编码提示的读向冲突，请核对颜色或用仪表确认。',
  },
};

export function ComponentScanner({ locale }: { locale: Locale }) {
  const t = text[locale === 'zh' ? 'zh' : 'en'];
  const video = useRef<HTMLVideoElement>(null);
  const resultPanel = useRef<HTMLDivElement>(null);
  const capturePanel = useRef<HTMLDivElement>(null);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [session, setSession] = useState(0);
  const [cameraAspect, setCameraAspect] = useState(4 / 3);
  const magnifier = useRef<HTMLCanvasElement>(null);
  const frozenFrame = useRef<{ canvas: HTMLCanvasElement; region: ReturnType<typeof componentRegion> | null } | null>(null);
  const readCurrent = useRef<((paused: boolean) => void) | null>(null);
  const [type, setType] = useState<ComponentType>('resistor');
  const [count, setCount] = useState(4);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<keyof Omit<typeof text.en, 'colors'> >('idle');
  const [bands, setBands] = useState<DetectedBand[]>([]);
  const [target, setTarget] = useState<ComponentTarget | null>(null);
  const [manualBands, setManualBands] = useState<string[]>(Array(4).fill(''));
  const [manual, setManual] = useState(false);
  const colors = manual ? manualBands : bands.map(b => b.color);
  const complete = colors.length === count && colors.every(c => bandColors.includes(c as BandColor));
  const assessment = assessBandDirection(complete ? colors as BandColor[] : [], type, bands.length === count ? bands : []);
  const readings = assessment.readings;
  const toleranceIndex = assessment.preferred ? (readings[0].reversed ? 0 : count - 1) : -1;
  const directionNote = assessment.reason === 'spacing' ? t.spacing.replace('{end}', readings[0].reversed ? t.left : t.right) : assessment.reason === 'invalid' ? '' : t[assessment.reason];
  const renderReading = (reading: BandReading, index: number) => <div className="scanner-candidate" key={index}><strong>{formatComponentValue(reading.value, type)} <small>{!manual && bands[reading.reversed ? 0 : bands.length - 1]?.uncertain ? t.checkTolerance : `±${reading.tolerance}%`}</small></strong><span>{reading.reversed ? t.direction : t.forward}</span></div>;

  useEffect(() => {
    if (review) { resultPanel.current?.focus({ preventScroll: true }); resultPanel.current?.scrollIntoView({ block: 'start' }); }
    else if (enabled) { capturePanel.current?.focus({ preventScroll: true }); capturePanel.current?.scrollIntoView({ block: 'start' }); }
  }, [review, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const consensus = new BandConsensus();
    let previous: ComponentTarget | null = null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const source = document.createElement('canvas');
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    const releaseStream = () => {
      if (!stream) return;
      stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
      stream = undefined;
    };
    const pauseOnHide = () => { if (document.hidden) { setEnabled(false); setStatus('ended'); } };
    document.addEventListener('visibilitychange', pauseOnHide);
    const open = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context || !sourceContext) { setStatus('unavailable'); setEnabled(false); return; }
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getVideoTracks().forEach(track => { track.onended = () => { setEnabled(false); setStatus('ended'); }; });
        const player = video.current;
        if (!player) { stream.getTracks().forEach(track => track.stop()); return; }
        player.srcObject = stream;
        await player.play();
        if (cancelled) return;
        setStatus('seeking');
        const scan = (paused: boolean) => {
          if (player.readyState < 2 || !player.videoWidth) return;
          setCameraAspect(player.videoWidth / player.videoHeight);
          source.width = player.videoWidth; source.height = player.videoHeight;
          sourceContext.drawImage(player, 0, 0, source.width, source.height);
          canvas.width = Math.min(640, source.width);
          canvas.height = Math.max(1, Math.round(source.height * canvas.width / source.width));
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const located = locateComponent(frame.data, canvas.width, canvas.height, previous);
          frozenFrame.current = { canvas: source, region: null };
          if (!located) {
            previous = null; consensus.reset();
            setTarget(null); setBands([]);
            if (paused) { const zoom = magnifier.current; const c = zoom?.getContext('2d'); if (zoom && c) { zoom.width = 560; zoom.height = Math.round(560 * source.height / source.width); c.drawImage(source, 0, 0, zoom.width, zoom.height); } setReview(true); }
            setStatus(paused ? 'pausedEmpty' : 'seeking'); return;
          }
          if (previous && Math.hypot(located.cx - previous.cx, located.cy - previous.cy) > Math.max(previous.length, located.length)) consensus.reset();
          previous = located; setTarget(located);
          const region = componentRegion(located, canvas.width, canvas.height, source.width, source.height);
          frozenFrame.current.region = region;
          const zoom = magnifier.current;
          const zoomContext = zoom?.getContext('2d');
          if (zoom && zoomContext) {
            zoom.width = 560; zoom.height = Math.max(1, Math.round(560 * region.height / region.width));
            zoomContext.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, zoom.width, zoom.height);
          }
          const pixels = sourceContext.getImageData(region.x, region.y, region.width, region.height);
          const found = readComponentBands(pixels.data, region.width, region.height, region.target, type);
          const accepted = paused ? found : consensus.add(found);
          if (!accepted) { setBands([]); if (paused) setReview(true); setStatus(paused ? 'unresolved' : region.target.length < 48 ? 'small' : 'located'); return; }
          setCount(accepted.length); setBands(accepted); setManual(false);
          const valid = assessBandDirection(accepted.map(b => b.color), type, accepted).readings.length > 0;
          if (!paused && valid) {
            clearInterval(timer); releaseStream(); readCurrent.current = null;
            setReview(true); setEnabled(false); setStatus('captured');
          } else { if (paused) setReview(true); setStatus(paused ? 'paused' : 'candidate'); }
        };
        readCurrent.current = scan;
        timer = setInterval(() => scan(false), 450);
      } catch (error) {
        if (cancelled) return;
        releaseStream();
        setBands([]);
        setTarget(null);
        setStatus(error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name) ? 'permission' : 'busy');
        setEnabled(false);
      }
    };
    void open();
    return () => {
      cancelled = true;
      readCurrent.current = null;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', pauseOnHide);
      releaseStream();
      if (video.current) video.current.srcObject = null;
    };
  }, [enabled, type]);

  const pause = () => {
    if (enabled) {
      if (readCurrent.current) readCurrent.current(true);
      else setStatus('idle');
      setEnabled(false);
    }
  };
  const reportPhoto = () => {
    pause();
    const frame = frozenFrame.current;
    if (!frame) return Promise.resolve(null);
    const photo = document.createElement('canvas');
    const region = frame.region ?? { x: 0, y: 0, width: frame.canvas.width, height: frame.canvas.height };
    photo.width = region.width; photo.height = region.height;
    const context = photo.getContext('2d');
    if (!context) return Promise.resolve(null);
    context.drawImage(frame.canvas, region.x, region.y, region.width, region.height, 0, 0, photo.width, photo.height);
    return new Promise<Blob | null>(resolve => photo.toBlob(resolve, 'image/jpeg', .95));
  };
  const reset = (nextType: ComponentType, nextCount: number) => {
    setConfirmed(false);
    if (review) {
      setType(nextType); setCount(nextCount); setBands([]); setManualBands(Array.from({ length: nextCount }, (_, i) => colors[i] || '')); setManual(true); setStatus('manual');
    } else {
      frozenFrame.current = null;
      setType(nextType); setCount(nextCount); setBands([]); setTarget(null); setManualBands(Array(nextCount).fill('')); setManual(false); setStatus('idle');
    }
  };
  const edit = (index: number, color: string) => {
    const next = Array.from({ length: count }, (_, i) => colors[i] || '');
    setConfirmed(false); next[index] = color; setManualBands(next); setManual(true); setStatus('manual');
  };

  const startScan = () => {
    frozenFrame.current = null; setReview(false); setConfirmed(false); setSession(n => n + 1);
    setBands([]); setTarget(null); setManual(false); setStatus('starting'); setEnabled(true);
  };
  const options = <div className="scanner-options">
    <label>{t.type}<select disabled={enabled} value={type} onChange={e => { const next = e.target.value as ComponentType; reset(next, next === 'inductor-mil' ? 5 : 4); }}>
      <option value="resistor">{t.resistor}</option><option value="inductor">{t.inductor}</option><option value="inductor-mil">{t.mil}</option>
    </select></label>
    <label>{t.count}<select disabled={enabled || type !== 'resistor'} value={count} onChange={e => reset(type, Number(e.target.value))}><option value="4">4</option><option value="5">5</option></select></label>
  </div>;
  return <><section id="component-scanner" className={`workbench component-scanner${review ? ' is-review' : ''}`}>
    {!review && <><div className="work-head"><span>{t.privacy}</span></div>{options}<p className="scanner-instruction">{t.guide}</p></>}
    <div className="scanner-view" ref={capturePanel} tabIndex={-1} hidden={review || !enabled} style={{ aspectRatio: cameraAspect, width: `min(100%, calc(min(45svh, 420px) * ${cameraAspect}))` }}>
      <video ref={video} autoPlay muted playsInline aria-label={t.guide}/>
      {!target && <div className="scanner-placement" aria-hidden="true"><span>{t.placement}</span></div>}
      {target && <div className="scanner-target" aria-label={t.located} style={{ left: `${target.box.x * 100}%`, top: `${target.box.y * 100}%`, width: `${target.box.width * 100}%`, height: `${target.box.height * 100}%` }}><span>{locale === 'zh' ? '已定位' : 'Located'}</span></div>}
    </div>
    {!review && <div className="actions scanner-capture-actions"><button className="primary" onClick={() => enabled ? pause() : startScan()}>{enabled ? t.stop : t.start}</button></div>}
    <div className="scanner-result" ref={resultPanel} tabIndex={-1} aria-label={t.reviewTitle}>
      {review && <div className="scanner-result-head"><h2>{t.reviewTitle}</h2><span>{t.cameraOff}</span></div>}
      {review && <p className="scanner-component-meta">{type === 'resistor' ? t.resistor : type === 'inductor-mil' ? t.mil : t.inductor} · {count}{locale === 'zh' ? ' 条色环' : ' bands'}</p>}
      <p className="scanner-status" role="status">{confirmed ? t.confirmed : t[status]}</p>
      <div className="scanner-reading" aria-live="polite">
        {readings.length ? <>{assessment.preferred ? <><p className="scanner-preferred">{t.preferred}</p>{renderReading(readings[0], 0)}</> : readings.map(renderReading)}</> : <p>{complete ? t.invalid : t.empty}</p>}
      </div>
      <figure className="scanner-magnifier" hidden={!target && !review}><figcaption>{target ? t.zoom : (locale === 'zh' ? '暂停画面' : 'Paused photo')}</figcaption><canvas ref={magnifier} aria-label={t.zoom}/></figure>
      {colors.some(Boolean) && <ol className="scanner-color-summary" aria-label={locale === 'zh' ? '画面从左到右的色环' : 'Bands from left to right'}>{colors.map((color, i) => <li key={i}><span className="scanner-summary-swatch" style={{ backgroundColor: colorHex[color as BandColor] }}>{i + 1}</span><span>{t.colors[bandColors.indexOf(color as BandColor)] || t.unknown}{!manual && bands[i]?.uncertain ? ' †' : ''}</span>{i === toleranceIndex && <small>{locale === 'zh' ? '容差' : 'Tolerance'}</small>}</li>)}</ol>}
      {readings.length > 1 && !assessment.preferred && <p className="scanner-uncertain">{directionNote}</p>}
      {!manual && bands.some(b => b.uncertain) && <p className="scanner-uncertain">{t.uncertain}</p>}
      {review && <div className="actions scanner-review-actions"><button className="primary" disabled={!readings.length || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? t.confirmed : t.confirm}</button><button onClick={startScan}>{t.rescan}</button></div>}
      {readings.length > 1 && assessment.preferred && <details className="scanner-alternatives"><summary>{t.alternatives}</summary>{readings.slice(1).map((r, i) => renderReading(r, i + 1))}</details>}
      {readings.length > 0 && <details className="scanner-evidence"><summary>{t.evidence}</summary><p className="scanner-direction-note">{directionNote}</p><p>{t.verify}</p></details>}
      <details className="scanner-correction" open={manual || undefined}>
        <summary>{t.correct}</summary>
        {review && options}
        <p>{t.correction}</p>
        <div className="scanner-bands">{Array.from({ length: count }, (_, i) => <label key={i}>
          {t.band} {i + 1}{i === toleranceIndex && <small className="scanner-tolerance-label">{t.toleranceBand}</small>}{!manual && bands[i]?.uncertain && <small>{t.checkColor}</small>}<span className="scanner-swatch" style={{ backgroundColor: colors[i] ? colorHex[colors[i] as BandColor] : 'transparent' }}/>
          <select aria-label={`${t.band} ${i + 1}`} disabled={enabled} value={colors[i] || ''} onChange={e => edit(i, e.target.value)}><option value="">{t.unknown}</option>{bandColors.map((c, index) => <option key={c} value={c}>{t.colors[index]}</option>)}</select>
        </label>)}</div>
        <button disabled={enabled || !colors.some(Boolean)} onClick={() => { setConfirmed(false); setManualBands([...colors].reverse()); setBands([]); setManual(true); setStatus('manual'); }}>{t.reverse}</button>
      </details>
      <ComponentDebug key={session} locale={locale} context={{ componentType: type, bandCount: count, colors, readings: readings.map(r => ({ value: r.value, tolerance: r.tolerance })), scanStatus: status, direction: { reason: assessment.reason, preferred: assessment.preferred, reversed: assessment.preferred ? readings[0].reversed : null } }} onOpen={reportPhoto}/>
      <p className="scanner-guide-link"><a href="#component-guide">{locale === 'zh' ? '色环与测量说明 ↓' : 'Color-code & measurement guide ↓'}</a></p>
      <details className="scanner-limits"><summary>{locale === 'zh' ? '支持范围与参考资料' : 'Supported codes & references'}</summary><p className="note">{t.limit}</p><div className="scanner-sources"><a href="https://www.vishay.com/docs/49411/resistor_color_code_calculator.pdf" target="_blank" rel="noreferrer">Vishay · resistor codes</a><a href="https://www.bourns.com/docs/technical-documents/technical-library/inductive-components/publications/ColorCodeMarkings.pdf" target="_blank" rel="noreferrer">Bourns · inductor codes</a></div></details>
    </div>
  </section><ComponentGuide locale={locale} onExample={(nextType, nextColors) => {
    frozenFrame.current = null; setReview(false); setConfirmed(false); setEnabled(false); setType(nextType); setCount(nextColors.length); setBands([]); setTarget(null); setManualBands([...nextColors]); setManual(true); setStatus('manual');
  }}/></>;
}
