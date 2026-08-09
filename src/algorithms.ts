export const money = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
export const num = (value: string | number) => Math.max(0, Number(value) || 0);
export const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[char] || char));
export const unescapeHtml = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({ "&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":"\"", "&#39;":"'" }[entity] || entity));
export const toBase64 = (value: string) => btoa(unescape(encodeURIComponent(value)));
export const fromBase64 = (value: string) => decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/"))));
export const uuid = () => crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; return (c === "x" ? r : (r & 3) | 8).toString(16); });
export async function digest(value: string, name = "SHA-256", key?: string) {
  const enc = new TextEncoder();
  if (key !== undefined) { const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: name }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(value)))).map(x => x.toString(16).padStart(2, "0")).join(""); }
  return Array.from(new Uint8Array(await crypto.subtle.digest(name, enc.encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
}
export const yaml = (v: unknown, depth = 0): string => {
  const pad = "  ".repeat(depth);
  if (Array.isArray(v)) return v.map(x => pad + "- " + (typeof x === "object" && x !== null ? "\n" + yaml(x, depth + 1) : String(x))).join("\n");
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => pad + k + ":" + (typeof x === "object" && x !== null ? "\n" + yaml(x, depth + 1) : " " + (typeof x === "string" ? JSON.stringify(x) : String(x)))).join("\n");
  return String(v);
};
export function csv(rows: Record<string, unknown>[]) { const keys = [...new Set(rows.flatMap(Object.keys))]; const q = (x: unknown) => '"' + String(x ?? "").replace(/\"/g, '""') + '"'; return [keys.map(q).join(","), ...rows.map(r => keys.map(k => q(r[k])).join(","))].join("\n"); }
export function mortgage(principal: number, annual: number, years: number) { const months = years * 12; const rate = annual / 1200; const payment = rate ? principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1) : principal / months; return { payment, total: payment * months, interest: payment * months - principal }; }
export function payoff(principal: number, annual: number, years: number, extra = 0) { let balance = principal, totalInterest = 0, month = 0; const normal = mortgage(principal, annual, years).payment, rate = annual / 1200; while (balance > .01 && month < 1200) { const interest = balance * rate; totalInterest += interest; balance -= Math.min(balance, normal + extra - interest); month++; } return { months: month, interest: totalInterest, payment: normal }; }
