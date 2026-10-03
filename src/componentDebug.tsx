import { useEffect, useRef, useState } from 'react';
import type { Locale } from './i18n';

type PreparedImage = { base64: string; width: number; height: number; bytes: number };
type ReportContext = { componentType: string; bandCount: number; colors: string[]; readings: { value: number; tolerance: number }[]; scanStatus: string; direction: { reason: string; preferred: boolean; reversed: boolean | null } };
type FeedbackSDK = {
  prepareFeedbackImage: (file: Blob) => Promise<PreparedImage>;
  FeedbackClient: new (config: { apiUrl: string; projectKey: string; signal?: AbortSignal }) => { submitFeedback(input: { resource: string; kind: 'issue'; body: string; image: PreparedImage; attachmentConsent: boolean }): Promise<{ id: string; has_attachment: boolean }> };
};
const api = 'https://discuss.integ.life';
let sdkPromise: Promise<FeedbackSDK> | undefined;
async function loadSDK() {
  // The shared service owns compression, consent and the report transport.
  const url = `${api}/v1/feedback/client.js`;
  sdkPromise ??= import(/* @vite-ignore */ url) as Promise<FeedbackSDK>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([sdkPromise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SDK unavailable')), 15000); })]);
  } catch (error) { sdkPromise = undefined; throw error; }
  finally { clearTimeout(timer); }
}

export function ComponentDebug({ locale, context, onOpen }: { locale: Locale; context: ReportContext; onOpen: () => void }) {
  const zh = locale === 'zh';
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<PreparedImage>();
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'preparing' | 'sending' | 'error' | 'sent'>('idle');
  const [receipt, setReceipt] = useState('');
  const [imageError, setImageError] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  const clear = () => { generation.current++; setImage(undefined); setConsent(false); setState('idle'); setReceipt(''); setImageError(false); if (fileInput.current) fileInput.current.value = ''; };
  const chooseImage = async (file?: File) => {
    clear();
    if (!file) return;
    const current = generation.current;
    setState('preparing');
    try {
      const sdk = await loadSDK();
      const prepared = await sdk.prepareFeedbackImage(file);
      if (current !== generation.current) return;
      setImage(prepared); setState('idle');
    } catch { if (current === generation.current) { setImageError(true); setState('error'); } }
  };
  const submit = async () => {
    if (!image || !consent || state === 'sending' || state === 'sent') return;
    const current = generation.current;
    setState('sending'); setImageError(false);
    try {
      const sdk = await loadSDK();
      controller.current = new AbortController();
      const client = new sdk.FeedbackClient({ apiUrl: api, projectKey: 'pk_tools_web_v1_9c2f6d', signal: controller.current.signal });
      const result = await client.submitFeedback({ resource: 'tool:component-scanner', kind: 'issue', body: JSON.stringify({ schema: 'integ-tools/component-report/v1', description: description.trim() || 'Component could not be read correctly', ...context }, null, 2), image, attachmentConsent: true });
      if (current !== generation.current) return;
      if (!result.id || !result.has_attachment) throw new Error('Missing attachment receipt');
      setReceipt(result.id); setImage(undefined); setConsent(false); setState('sent');
      if (fileInput.current) fileInput.current.value = '';
    } catch { if (current === generation.current) setState('error'); }
  };
  return <div className="scanner-debug">
    <label className="debug-toggle"><input type="checkbox" checked={open} disabled={state === 'sending'} onChange={e => { setOpen(e.target.checked); clear(); if (e.target.checked) onOpen(); }}/>{zh ? 'Debug / 报告识别问题' : 'Debug / report a recognition problem'}</label>
    {open && <div className="debug-form">
      <p>{zh ? '识别失败或结果不对时，请选择一张清晰的元件照片。图片将在本机压缩，预览后由你主动提交给 Integ Feedback，帮助我们改进识别。' : 'If scanning fails or gives the wrong value, choose a clear component photo. It is compressed locally; preview it and submit it to Integ Feedback to help improve the reader.'}</p>
      <label>{zh ? '元件照片（JPEG / PNG / WebP，最多 12 MiB）' : 'Component photo (JPEG / PNG / WebP, up to 12 MiB)'}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={state === 'sending' || state === 'sent'} onChange={e => { void chooseImage(e.target.files?.[0]); }}/></label>
      {image && <><img className="debug-image" src={`data:image/jpeg;base64,${image.base64}`} alt={zh ? '将提交的元件照片' : 'Component photo to submit'}/><p>{image.width} × {image.height} · {Math.ceil(image.bytes / 1024)} KiB</p></>}
      <label>{zh ? '问题描述 / 预期数值（可选）' : 'Problem / expected value (optional)'}<textarea maxLength={2000} rows={3} disabled={state === 'sending' || state === 'sent'} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <p>{zh ? '报告还包含当前元件类型、色环数量、颜色、候选读数和读向判断依据。照片及报告由维护者私下查看；图片 30 天后过期，报告文字保留。请只拍元件，避开个人信息。' : 'The report also includes the selected component type, band count, colors, candidate values and direction evidence. Maintainers review reports privately. Images expire after 30 days; report text is retained. Keep personal information out of the photo.'}</p>
      <label className="debug-toggle"><input type="checkbox" disabled={!image || state === 'sending'} checked={consent} onChange={e => setConsent(e.target.checked)}/>{zh ? '我同意上传预览图片和上述诊断信息，用于排查识别问题。' : 'I agree to upload the preview image and the diagnostics above to investigate this recognition problem.'}</label>
      <button className="primary" disabled={!image || !consent || state === 'preparing' || state === 'sending' || state === 'sent'} onClick={() => { void submit(); }}>{state === 'sending' ? (zh ? '正在提交…' : 'Submitting…') : (zh ? '提交问题报告' : 'Submit problem report')}</button>
      <p role="status">{state === 'preparing' ? (zh ? '正在本机准备图片…' : 'Preparing image locally…') : state === 'error' ? (imageError ? (zh ? '无法准备图片，请选用 JPEG、PNG 或 WebP 格式，也请检查网络后重试。' : 'Could not prepare the image. Use JPEG, PNG or WebP and check your connection before retrying.') : (zh ? '提交未确认，图片仍保留在本页面，请检查网络后重试。' : 'Submission was not confirmed. The image remains on this page; check your connection and retry.')) : state === 'sent' ? `${zh ? '报告已收到，编号：' : 'Report received. ID: '}${receipt}` : ''}</p>
      {state === 'sent' && <button onClick={() => { clear(); setDescription(''); }}>{zh ? '提交另一个问题' : 'Report another problem'}</button>}
    </div>}
  </div>;
}
