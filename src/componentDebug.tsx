import { useEffect, useRef, useState } from 'react';
import type { Locale } from './i18n';

type PreparedImage = { base64: string; width: number; height: number; bytes: number };
type ReportContext = { componentType: string; bandCount: number; colors: string[]; readings: { value: number; tolerance: number }[]; scanStatus: string; direction: { reason: string; preferred: boolean; reversed: boolean | null } };
type FeedbackSDK = {
  prepareFeedbackImage: (file: Blob) => Promise<PreparedImage>;
  FeedbackClient: new (config: { apiUrl: string; projectKey: string; signal?: AbortSignal }) => { submitFeedback(input: { resource: string; kind: 'issue'; body: string; images: PreparedImage[]; attachmentConsent: boolean }): Promise<{ id: string; has_attachment: boolean; attachment_count: number }> };
};
const api = 'https://discuss.integ.life';
let sdkPromise: Promise<FeedbackSDK> | undefined;
async function loadSDK() {
  // The shared service owns compression, consent and the report transport.
  const url = `${api}/v1/feedback/client.js?v=20261003-multiple-images`;
  sdkPromise ??= import(/* @vite-ignore */ url) as Promise<FeedbackSDK>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([sdkPromise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SDK unavailable')), 15000); })]);
  } catch (error) { sdkPromise = undefined; throw error; }
  finally { clearTimeout(timer); }
}

export function ComponentDebug({ locale, context, onOpen }: { locale: Locale; context: ReportContext; onOpen: () => Promise<Blob | null> }) {
  const zh = locale === 'zh';
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<{ image: PreparedImage; current: boolean }[]>([]);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'preparing' | 'sending' | 'error' | 'sent'>('idle');
  const [receipt, setReceipt] = useState('');
  const [imageError, setImageError] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  const clear = () => { generation.current++; setImages([]); setConsent(false); setState('idle'); setReceipt(''); setImageError(false); if (fileInput.current) fileInput.current.value = ''; };
  const prepare = async (photos: Promise<Blob | null>[] | Blob[], currentPhoto: boolean) => {
    const current = generation.current;
    setState('preparing'); setConsent(false); setImageError(false);
    try {
      const resolved: (Blob | null)[] = await Promise.all(photos);
      const files = resolved.filter((file): file is Blob => file !== null);
      if (!files.length) { if (current === generation.current) setState('idle'); return; }
      if (files.length + (currentPhoto ? 0 : images.length) > 4) throw new Error('Too many images');
      const sdk = await loadSDK();
      const prepared = await Promise.all(files.map(file => sdk.prepareFeedbackImage(file)));
      if (current !== generation.current) return;
      const next = prepared.map(image => ({ image, current: currentPhoto }));
      setImages(previous => currentPhoto ? next : [...previous, ...next]); setState('idle');
    } catch { if (current === generation.current) { setImageError(true); setState('error'); } }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const capture = () => { clear(); void prepare([onOpen()], true); };
  const submit = async () => {
    if (!images.length || !consent || state === 'preparing' || state === 'sending' || state === 'sent') return;
    const current = generation.current;
    setState('sending'); setImageError(false);
    try {
      const sdk = await loadSDK();
      controller.current = new AbortController();
      const client = new sdk.FeedbackClient({ apiUrl: api, projectKey: 'pk_tools_web_v1_9c2f6d', signal: controller.current.signal });
      const result = await client.submitFeedback({ resource: 'tool:component-scanner', kind: 'issue', body: JSON.stringify({ schema: 'integ-tools/component-report/v2', description: description.trim() || 'Component could not be read correctly', ...context, photos: images.map(item => item.current ? 'current-scan' : 'additional') }, null, 2), images: images.map(item => item.image), attachmentConsent: true });
      if (current !== generation.current) return;
      if (!result.id || !result.has_attachment || result.attachment_count !== images.length) throw new Error('Missing attachment receipt');
      setReceipt(result.id); setImages([]); setConsent(false); setState('sent');
      if (fileInput.current) fileInput.current.value = '';
    } catch { if (current === generation.current) setState('error'); }
  };
  const busy = state === 'preparing' || state === 'sending';
  return <div className="scanner-debug">
    <label className="debug-toggle"><input type="checkbox" checked={open} disabled={state === 'sending'} onChange={e => { setOpen(e.target.checked); if (e.target.checked) capture(); else clear(); }}/>{zh ? 'Debug / 报告识别问题' : 'Debug / report a recognition problem'}</label>
    {open && <div className="debug-form">
      <p>{zh ? '已自动带入当前扫描照片；定位成功时使用元件局部特写。无需重新上传，可选择补充其他照片。图片先在本机准备，只有点击提交才会发送。' : 'The current scan photo is included automatically, cropped to the located component when available. No upload selection is needed; additional photos are optional. Images are prepared locally and sent only when you submit.'}</p>
      {!images.length && !busy && state !== 'sent' && <p>{zh ? '目前没有扫描照片。可以重新打开摄像头，或选择一张照片。' : 'No scan photo is available. Start the camera or choose a photo.'}</p>}
      {images.map(({ image, current }, index) => <figure key={index} className="debug-photo"><figcaption>{current ? (zh ? '当前扫描照片' : 'Current scan photo') : (zh ? '补充照片' : 'Additional photo')}</figcaption><img className="debug-image" src={`data:image/jpeg;base64,${image.base64}`} alt={zh ? `将提交的照片 ${index + 1}` : `Photo ${index + 1} to submit`}/><p>{image.width} × {image.height} · {Math.ceil(image.bytes / 1024)} KiB</p><button disabled={busy} onClick={() => { setImages(previous => previous.filter((_, i) => i !== index)); setConsent(false); setState('idle'); }}>{zh ? '移除这张照片' : 'Remove this photo'}</button></figure>)}
      <label>{zh ? `补充照片（可选，合计最多 4 张，每张 JPEG / PNG / WebP ≤ 12 MiB）` : 'Additional photos (optional, up to 4 total; JPEG / PNG / WebP ≤ 12 MiB each)'}<input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || state === 'sent' || images.length >= 4} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) void prepare(files, false); }}/></label>
      {imageError && <button disabled={busy} onClick={capture}>{zh ? '重新带入当前照片' : 'Retry current photo'}</button>}
      <label>{zh ? '问题描述 / 预期数值（可选）' : 'Problem / expected value (optional)'}<textarea maxLength={2000} rows={3} disabled={busy || state === 'sent'} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <p>{zh ? '报告还包含当前元件类型、色环数量、颜色、候选读数和读向判断依据。照片及报告由维护者私下查看；图片 30 天后过期，报告文字保留。请只拍元件，避开个人信息。' : 'The report also includes component type, band count, colors, candidate values and direction evidence. Maintainers review reports privately. Images expire after 30 days; report text is retained. Keep personal information out of photos.'}</p>
      <label className="debug-toggle"><input type="checkbox" disabled={!images.length || busy || state === 'sent'} checked={consent} onChange={e => setConsent(e.target.checked)}/>{zh ? '我同意上传全部预览图片和上述诊断信息，用于排查识别问题。' : 'I agree to upload all preview images and the diagnostics above to investigate this recognition problem.'}</label>
      <button className="primary" disabled={!images.length || !consent || busy || state === 'sent'} onClick={() => { void submit(); }}>{state === 'sending' ? (zh ? '正在提交…' : 'Submitting…') : (zh ? '提交问题报告' : 'Submit problem report')}</button>
      <p role="status">{state === 'preparing' ? (zh ? '正在本机准备图片…' : 'Preparing images locally…') : state === 'error' ? (imageError ? (zh ? '无法准备图片，请使用支持的格式，合计最多 4 张；检查网络后可以重试。' : 'Could not prepare images. Use a supported format, up to 4 total, and check your connection before retrying.') : (zh ? '提交未确认，图片仍保留在本页面，请检查网络后重试。' : 'Submission was not confirmed. Images remain on this page; check your connection and retry.')) : state === 'sent' ? `${zh ? '报告已收到，编号：' : 'Report received. ID: '}${receipt}` : ''}</p>
      {state === 'sent' && <button onClick={() => { setDescription(''); capture(); }}>{zh ? '提交另一个问题' : 'Report another problem'}</button>}
    </div>}
  </div>;
}
