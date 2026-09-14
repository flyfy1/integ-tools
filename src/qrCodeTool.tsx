import { useMemo, useState } from "react";
import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";
import { copy, type Locale } from "./i18n";
import "./qrCodeTool.css";

type Level = Extract<QRCodeErrorCorrectionLevel, "L" | "M" | "Q" | "H">;

const labels: Record<Locale, {
  content: string;
  placeholder: string;
  correction: string;
  size: string;
  margin: string;
  foreground: string;
  background: string;
  downloadPng: string;
  downloadSvg: string;
  ready: string;
  modules: string;
  hint: string;
  error: string;
}> = {
  en: { content: "Text or URL", placeholder: "Enter text or a link", correction: "Error correction", size: "Image size", margin: "Quiet-zone margin", foreground: "Foreground", background: "Background", downloadPng: "Download PNG", downloadSvg: "Download SVG", ready: "Ready to scan", modules: "modules", hint: "For reliable scanning, keep strong contrast and a margin of at least 4.", error: "This content cannot be encoded. Try shorter text." },
  zh: { content: "文本或网址", placeholder: "输入文本或链接", correction: "纠错级别", size: "图片尺寸", margin: "留白边距", foreground: "前景色", background: "背景色", downloadPng: "下载 PNG", downloadSvg: "下载 SVG", ready: "可以扫码", modules: "模块", hint: "为保证识别效果，请保持较强色彩对比，并建议保留至少 4 格边距。", error: "无法编码这些内容，请缩短文本后重试。" },
  es: { content: "Texto o URL", placeholder: "Introduce texto o un enlace", correction: "Corrección de errores", size: "Tamaño de imagen", margin: "Margen silencioso", foreground: "Primer plano", background: "Fondo", downloadPng: "Descargar PNG", downloadSvg: "Descargar SVG", ready: "Listo para escanear", modules: "módulos", hint: "Mantén un contraste alto y un margen mínimo de 4 para facilitar el escaneo.", error: "No se puede codificar este contenido. Prueba con un texto más corto." },
  hi: { content: "टेक्स्ट या URL", placeholder: "टेक्स्ट या लिंक दर्ज करें", correction: "त्रुटि सुधार", size: "इमेज आकार", margin: "खाली बॉर्डर", foreground: "अग्रभूमि", background: "पृष्ठभूमि", downloadPng: "PNG डाउनलोड करें", downloadSvg: "SVG डाउनलोड करें", ready: "स्कैन के लिए तैयार", modules: "मॉड्यूल", hint: "अच्छी स्कैनिंग के लिए स्पष्ट कंट्रास्ट और कम से कम 4 का मार्जिन रखें।", error: "इस सामग्री को एनकोड नहीं किया जा सकता। छोटा टेक्स्ट आज़माएँ।" },
  ar: { content: "نص أو رابط", placeholder: "أدخل نصًا أو رابطًا", correction: "تصحيح الأخطاء", size: "حجم الصورة", margin: "الهامش الهادئ", foreground: "لون المقدمة", background: "لون الخلفية", downloadPng: "تنزيل PNG", downloadSvg: "تنزيل SVG", ready: "جاهز للمسح", modules: "وحدة", hint: "حافظ على تباين قوي وهامش لا يقل عن 4 لضمان سهولة المسح.", error: "تعذر ترميز هذا المحتوى. جرّب نصًا أقصر." },
  ja: { content: "テキストまたは URL", placeholder: "テキストまたはリンクを入力", correction: "誤り訂正", size: "画像サイズ", margin: "余白", foreground: "前景色", background: "背景色", downloadPng: "PNG をダウンロード", downloadSvg: "SVG をダウンロード", ready: "スキャンできます", modules: "モジュール", hint: "読み取りやすくするため、十分なコントラストと 4 以上の余白を保ってください。", error: "この内容はエンコードできません。テキストを短くしてください。" },
  id: { content: "Teks atau URL", placeholder: "Masukkan teks atau tautan", correction: "Koreksi kesalahan", size: "Ukuran gambar", margin: "Margin kosong", foreground: "Warna depan", background: "Latar belakang", downloadPng: "Unduh PNG", downloadSvg: "Unduh SVG", ready: "Siap dipindai", modules: "modul", hint: "Gunakan kontras kuat dan margin minimal 4 agar mudah dipindai.", error: "Konten ini tidak dapat dikodekan. Coba teks yang lebih pendek." },
};

const initialValue = "https://tools.integ.life/";

export function createQrSvg(value: string, level: Level, margin: number, foreground: string, background: string) {
  const code = QRCode.create(value, { errorCorrectionLevel: level });
  const moduleCount = code.modules.size;
  const safeMargin = Math.max(0, Math.min(16, Math.round(margin)));
  const viewSize = moduleCount + safeMargin * 2;
  let path = "";
  for (let row = 0; row < moduleCount; row += 1) {
    let start = -1;
    for (let col = 0; col <= moduleCount; col += 1) {
      const dark = col < moduleCount && Boolean(code.modules.get(row, col));
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        path += `M${start + safeMargin} ${row + safeMargin}h${col - start}v1H${start + safeMargin}z`;
        start = -1;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${background}"/><path d="${path}" fill="${foreground}"/></svg>`;
  return { svg, path, moduleCount, viewSize };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function QrCodeTool({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const q = labels[locale];
  const [value, setValue] = useState(initialValue);
  const [level, setLevel] = useState<Level>("M");
  const [imageSize, setImageSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [foreground, setForeground] = useState("#14201d");
  const [background, setBackground] = useState("#ffffff");

  const generated = useMemo(() => {
    if (!value.trim()) return { error: "" } as const;
    try {
      return { ...createQrSvg(value, level, margin, foreground, background), error: "" } as const;
    } catch {
      return { error: q.error } as const;
    }
  }, [value, level, margin, foreground, background, q.error]);

  const reset = () => {
    setValue(initialValue);
    setLevel("M");
    setImageSize(512);
    setMargin(4);
    setForeground("#14201d");
    setBackground("#ffffff");
  };

  const downloadSvg = () => {
    if (!("svg" in generated)) return;
    saveBlob(new Blob([generated.svg], { type: "image/svg+xml;charset=utf-8" }), "qr-code.svg");
  };

  const downloadPng = async () => {
    if (!("svg" in generated)) return;
    const dataUrl = await QRCode.toDataURL(value, {
      type: "image/png",
      width: imageSize,
      margin: Math.max(0, Math.min(16, Math.round(margin))),
      errorCorrectionLevel: level,
      color: { dark: `${foreground}ff`, light: `${background}ff` },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-code-${imageSize}.png`;
    link.click();
  };

  return <section className="workbench qr-workbench">
    <div className="work-head"><b>{t.local}</b><span>● {t.noUpload}</span></div>
    <div className="qr-layout">
      <div className="qr-controls">
        <label className="qr-content">{q.content}<textarea value={value} onChange={event => setValue(event.target.value)} placeholder={q.placeholder} spellCheck={false}/></label>
        <div className="qr-options">
          <label>{q.correction}<select value={level} onChange={event => setLevel(event.target.value as Level)}><option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></label>
          <label>{q.size}<select value={imageSize} onChange={event => setImageSize(Number(event.target.value))}><option value="256">256 × 256</option><option value="512">512 × 512</option><option value="1024">1024 × 1024</option></select></label>
          <label>{q.margin}<input type="number" min="0" max="16" value={margin} onChange={event => setMargin(Number(event.target.value))}/></label>
          <label>{q.foreground}<span className="color-input"><input type="color" value={foreground} onChange={event => setForeground(event.target.value)}/><span>{foreground.toUpperCase()}</span></span></label>
          <label>{q.background}<span className="color-input"><input type="color" value={background} onChange={event => setBackground(event.target.value)}/><span>{background.toUpperCase()}</span></span></label>
        </div>
        <p className="qr-hint">{q.hint}</p>
      </div>
      <div className="qr-preview" aria-live="polite">
        {"svg" in generated ? <>
          <svg className="qr-code-preview" viewBox={`0 0 ${generated.viewSize} ${generated.viewSize}`} role="img" aria-label={q.ready} shapeRendering="crispEdges">
            <rect width="100%" height="100%" fill={background}/>
            <path d={generated.path} fill={foreground}/>
          </svg>
          <div className="qr-status"><strong>{q.ready}</strong><span>{generated.moduleCount} × {generated.moduleCount} {q.modules}</span></div>
        </> : <div className="qr-empty">{generated.error || q.placeholder}</div>}
      </div>
    </div>
    <div className="qr-actions">
      <button className="primary" disabled={!("svg" in generated)} onClick={downloadPng}>{q.downloadPng}</button>
      <button disabled={!("svg" in generated)} onClick={downloadSvg}>{q.downloadSvg}</button>
      <button onClick={reset}>{t.reset}</button>
    </div>
  </section>;
}
