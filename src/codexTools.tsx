import { useEffect, useState, type ReactNode } from "react";
import type { Locale } from "./i18n";

const plans = {
  free: ["Free", 0],
  go: ["Go", 8],
  plus: ["Plus", 20],
  pro5: ["Pro 5×", 100],
  pro20: ["Pro 20×", 200],
  businessAnnual: ["Business (annual)", 20],
  businessMonthly: ["Business (monthly)", 25],
} as const;
const countries = {
  US: ["United States", "USD", 1, 0],
  SG: ["Singapore", "SGD", 1.35, 9],
  CN: ["China", "CNY", 7.2, 0],
  JP: ["Japan", "JPY", 147, 10],
  IN: ["India", "INR", 88, 18],
  GB: ["United Kingdom", "GBP", 0.75, 20],
  DE: ["Germany", "EUR", 0.86, 19],
  AU: ["Australia", "AUD", 1.53, 10],
  BR: ["Brazil", "BRL", 5.45, 0],
  ID: ["Indonesia", "IDR", 16250, 11],
} as const;
const labels = (locale: Locale) =>
  locale === "zh"
    ? {
        local: "所有设置仅保存在此浏览器",
        country: "国家/地区",
        plan: "计划",
        seats: "席位",
        rate: "1 USD 兑换",
        tax: "税率 %",
        monthly: "每月估算",
        annual: "每年估算",
        usd: "税前美元基准",
        caveat:
          "基于公开美元标价、可编辑汇率和税率的估算，不是 OpenAI 结账报价。App Store、Google Play 和本地定价可能不同。",
        resetAt: "额度重置时间",
        save: "保存重置时间",
        clear: "清除",
        remaining: "剩余时间",
        ready: "额度应已重置",
        resetHint:
          "从 Codex Usage 页面复制实际显示的重置时间。此工具不会读取你的账户。",
        model: "模型",
        input: "输入 tokens",
        cached: "缓存输入 tokens",
        output: "输出 tokens",
        credits: "估算 credits",
        breakdown: "计算明细",
        rateCard:
          "使用 2026-04-02 起的官方 token-based rate card。实际用量以 Codex Usage 为准。",
      }
    : {
        local: "All settings stay in this browser",
        country: "Country / region",
        plan: "Plan",
        seats: "Seats",
        rate: "Local currency per USD",
        tax: "Tax %",
        monthly: "Estimated monthly",
        annual: "Estimated annual",
        usd: "USD list-price subtotal",
        caveat:
          "Estimate based on public USD list prices plus editable FX and tax—not an OpenAI checkout quote. App Store, Google Play, and localized prices may differ.",
        resetAt: "Limit resets at",
        save: "Save reset time",
        clear: "Clear",
        remaining: "Time remaining",
        ready: "Limit should be reset",
        resetHint:
          "Copy the actual reset time shown on your Codex Usage page. This tool never reads your account.",
        model: "Model",
        input: "Input tokens",
        cached: "Cached input tokens",
        output: "Output tokens",
        credits: "Estimated credits",
        breakdown: "Breakdown",
        rateCard:
          "Uses the official token-based rate card effective April 2, 2026. Your Codex Usage page is authoritative.",
      };

export function CodexTool({ kind, locale }: { kind: string; locale: Locale }) {
  if (kind === "codex-plan-cost") return <PlanCost locale={locale} />;
  if (kind === "codex-reset") return <ResetTimer locale={locale} />;
  return <CreditEstimator locale={locale} />;
}
function Shell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <section className="workbench codex-tool">
      <div className="work-head">
        <b>CODEX</b>
        <span>● {labels(locale).local}</span>
      </div>
      {children}
      <p className="codex-source">
        <a
          href="https://learn.chatgpt.com/docs/pricing"
          target="_blank"
          rel="noreferrer"
        >
          OpenAI pricing source ↗
        </a>
      </p>
    </section>
  );
}
function PlanCost({ locale }: { locale: Locale }) {
  const t = labels(locale),
    [country, setCountry] = useState<keyof typeof countries>("SG"),
    [plan, setPlan] = useState<keyof typeof plans>("plus"),
    [seats, setSeats] = useState(1),
    preset = countries[country],
    [rate, setRate] = useState<number>(preset[2]),
    [tax, setTax] = useState<number>(preset[3]);
  const subtotal = plans[plan][1] * Math.max(1, seats),
    total = subtotal * rate * (1 + tax / 100),
    format = (value: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: preset[1],
        maximumFractionDigits: preset[1] === "JPY" ? 0 : 2,
      }).format(value);
  return (
    <Shell locale={locale}>
      <div className="codex-grid">
        <label>
          {t.country}
          <select
            value={country}
            onChange={(e) => {
              const next = e.target.value as keyof typeof countries;
              setCountry(next);
              setRate(countries[next][2]);
              setTax(countries[next][3]);
            }}
          >
            {Object.entries(countries).map(([key, value]) => (
              <option key={key} value={key}>
                {value[0]} · {value[1]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.plan}
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as keyof typeof plans)}
          >
            {Object.entries(plans).map(([key, value]) => (
              <option key={key} value={key}>
                {value[0]} · ${value[1]}/mo
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.seats}
          <input
            type="number"
            min="1"
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          />
        </label>
        <label>
          {t.rate} ({preset[1]})
          <input
            type="number"
            min="0"
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label>
          {t.tax}
          <input
            type="number"
            min="0"
            step="0.1"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="result">
        <div>
          <span>{t.usd}</span>
          <strong>${subtotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>{t.monthly}</span>
          <strong>{format(total)}</strong>
        </div>
        <div>
          <span>{t.annual}</span>
          <strong>{format(total * 12)}</strong>
        </div>
      </div>
      <p className="note">{t.caveat}</p>
    </Shell>
  );
}
function ResetTimer({ locale }: { locale: Locale }) {
  const t = labels(locale),
    [resetAt, setResetAt] = useState(
      () => localStorage.getItem("codex-reset-at") || "",
    ),
    [now, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = resetAt ? new Date(resetAt).getTime() - now : 0,
    countdown =
      remaining <= 0
        ? t.ready
        : `${Math.floor(remaining / 86400000)}d ${Math.floor(remaining / 3600000) % 24}h ${Math.floor(remaining / 60000) % 60}m ${Math.floor(remaining / 1000) % 60}s`;
  return (
    <Shell locale={locale}>
      <div className="codex-grid">
        <label>
          {t.resetAt}
          <input
            type="datetime-local"
            value={resetAt}
            onChange={(e) => setResetAt(e.target.value)}
          />
        </label>
      </div>
      <div className="actions">
        <button
          className="primary"
          onClick={() => localStorage.setItem("codex-reset-at", resetAt)}
        >
          {t.save}
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("codex-reset-at");
            setResetAt("");
          }}
        >
          {t.clear}
        </button>
      </div>
      <div className="result">
        <div>
          <span>{t.remaining}</span>
          <strong>{countdown}</strong>
        </div>
      </div>
      <p className="note">{t.resetHint}</p>
    </Shell>
  );
}
function CreditEstimator({ locale }: { locale: Locale }) {
  const t = labels(locale),
    [model, setModel] = useState<"gpt-5.5" | "gpt-5.5-cyber">("gpt-5.5"),
    [input, setInput] = useState(100000),
    [cached, setCached] = useState(50000),
    [output, setOutput] = useState(20000),
    rates = model === "gpt-5.5" ? [125, 12.5, 750] : [500, 50, 3000],
    parts = [
      (input * rates[0]) / 1e6,
      (cached * rates[1]) / 1e6,
      (output * rates[2]) / 1e6,
    ];
  return (
    <Shell locale={locale}>
      <div className="codex-grid">
        <label>
          {t.model}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
          >
            <option value="gpt-5.5">GPT-5.5</option>
            <option value="gpt-5.5-cyber">GPT-5.5 Cyber</option>
          </select>
        </label>
        <label>
          {t.input}
          <input
            type="number"
            min="0"
            value={input}
            onChange={(e) => setInput(Number(e.target.value))}
          />
        </label>
        <label>
          {t.cached}
          <input
            type="number"
            min="0"
            value={cached}
            onChange={(e) => setCached(Number(e.target.value))}
          />
        </label>
        <label>
          {t.output}
          <input
            type="number"
            min="0"
            value={output}
            onChange={(e) => setOutput(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="result">
        <div>
          <span>{t.credits}</span>
          <strong>{parts.reduce((a, b) => a + b, 0).toFixed(2)}</strong>
        </div>
        <div>
          <span>{t.breakdown}</span>
          <strong>{parts.map((v) => v.toFixed(2)).join(" + ")}</strong>
        </div>
      </div>
      <p className="note">{t.rateCard}</p>
    </Shell>
  );
}
