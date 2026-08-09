/** Pure, dependency-free browser developer-tool algorithms. */

export type JsonPathValue = unknown;
export type QueryValues = Record<string, string | string[]>;
export type UserAgentInfo = { browser: string; browserVersion: string | null; os: string; device: "mobile" | "tablet" | "desktop" | "bot" | "unknown" };
export type SubnetInfo = { address: string; prefix: number; mask: string; network: string; broadcast: string; firstHost: string | null; lastHost: string | null; totalAddresses: number; usableHosts: number };
export type DownloadEstimate = { seconds: number; human: string };

const ensureText = (value: unknown, label = "Value") => {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
};

const identifier = (key: string) => /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);

/** Infers a TypeScript type alias from valid JSON. */
export function jsonToTypeScript(json: string, rootName = "Root"): string {
  ensureText(json, "JSON");
  if (!/^[A-Za-z_$][\w$]*$/.test(rootName)) throw new Error("Root type name must be a valid TypeScript identifier.");
  let value: unknown;
  try { value = JSON.parse(json); } catch (error) { throw new Error(`Invalid JSON: ${(error as Error).message}`); }
  const infer = (item: unknown, level = 0): string => {
    const pad = "  ".repeat(level);
    const next = "  ".repeat(level + 1);
    if (item === null) return "null";
    if (Array.isArray(item)) {
      if (!item.length) return "unknown[]";
      const variants = [...new Set(item.map(x => infer(x, level)))];
      return `(${variants.join(" | ")})[]`;
    }
    if (typeof item === "object") {
      const entries = Object.entries(item as Record<string, unknown>);
      if (!entries.length) return "Record<string, never>";
      return `{\n${entries.map(([key, child]) => `${next}${identifier(key)}: ${infer(child, level + 1)};`).join("\n")}\n${pad}}`;
    }
    if (typeof item === "string") return "string";
    if (typeof item === "number") return "number";
    if (typeof item === "boolean") return "boolean";
    return "unknown";
  };
  return `export type ${rootName} = ${infer(value)};\n`;
}

/** Gets values from JSON using a small, safe JSONPath subset: $, .name, [0], ['name'], and [*]. */
export function getJsonPath(value: unknown, path: string): JsonPathValue[] {
  ensureText(path, "JSONPath");
  if (!path.startsWith("$")) throw new Error("JSONPath must start with $.");
  const tokens: (string | number | "*")[] = [];
  let i = 1;
  while (i < path.length) {
    if (path[i] === ".") {
      const match = path.slice(i + 1).match(/^[A-Za-z_$][\w$]*/);
      if (!match) throw new Error(`Invalid property token at character ${i + 1}.`);
      tokens.push(match[0]); i += match[0].length + 1; continue;
    }
    if (path[i] === "[") {
      const end = path.indexOf("]", i + 1);
      if (end < 0) throw new Error("Unclosed JSONPath bracket.");
      const raw = path.slice(i + 1, end).trim();
      if (raw === "*") tokens.push("*");
      else if (/^\d+$/.test(raw)) tokens.push(Number(raw));
      else if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) tokens.push(raw.slice(1, -1));
      else throw new Error(`Unsupported bracket token: ${raw}.`);
      i = end + 1; continue;
    }
    throw new Error(`Unexpected JSONPath character at ${i}.`);
  }
  return tokens.reduce<unknown[]>((values, token) => values.flatMap(item => {
    if (token === "*") return Array.isArray(item) ? item : item && typeof item === "object" ? Object.values(item as object) : [];
    if (typeof token === "number") return Array.isArray(item) && token in item ? [item[token]] : [];
    return item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, token) ? [(item as Record<string, unknown>)[token]] : [];
  }), [value]);
}

/** Formats SQL keywords and line breaks while preserving quoted string content. */
export function formatSql(sql: string): string {
  ensureText(sql, "SQL");
  if (!sql.trim()) throw new Error("SQL cannot be empty.");
  const pieces = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\S+/g);
  if (!pieces) throw new Error("Could not tokenize SQL.");
  const keyword = new Set(["SELECT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "UNION", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "AS", "AND", "OR", "CASE", "WHEN", "THEN", "ELSE", "END"]);
  const breaks = new Set(["FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "UNION", "INSERT", "UPDATE", "DELETE", "VALUES", "SET"]);
  let output = "";
  for (const token of pieces) {
    const upper = token.toUpperCase();
    const next = keyword.has(upper) ? upper : token;
    if (breaks.has(upper) && output.trim()) output = output.trimEnd() + "\n";
    output += (output && !output.endsWith("\n") ? " " : "") + next;
  }
  return output.replace(/\s*,\s*/g, ", ").replace(/, (?=\w+\s+FROM\b)/i, ",\n  ").trim() + ";";
}

/** Indents a well-formed XML document without parsing external entities. */
export function formatXml(xml: string, indent = "  "): string {
  ensureText(xml, "XML");
  if (!xml.trim()) throw new Error("XML cannot be empty.");
  if (!indent) throw new Error("Indent cannot be empty.");
  const compact = xml.replace(/>\s+</g, "><").trim();
  const tokens = compact.match(/<!--[\s\S]*?-->|<\?.*?\?>|<!\[CDATA\[[\s\S]*?]]>|<[^>]+>|[^<]+/g);
  if (!tokens || tokens.join("") !== compact) throw new Error("Invalid XML token sequence.");
  let depth = 0; const lines: string[] = []; const stack: string[] = [];
  for (const token of tokens) {
    if (!token.trim()) continue;
    if (/^<\//.test(token)) { depth--; const tag = token.match(/^<\/\s*([^\s>]+)/)?.[1]; if (depth < 0 || stack.pop() !== tag) throw new Error("Mismatched XML closing tag."); lines.push(indent.repeat(depth) + token); }
    else if (/^<[^!?/][^>]*\/>$/.test(token) || /^<\?/.test(token) || /^<!/.test(token)) lines.push(indent.repeat(depth) + token);
    else if (/^<[^!?/]/.test(token)) { const tag = token.match(/^<\s*([^\s/>]+)/)?.[1]; if (!tag) throw new Error("Invalid XML opening tag."); lines.push(indent.repeat(depth) + token); stack.push(tag); depth++; }
    else lines.push(indent.repeat(depth) + token.trim());
  }
  if (stack.length) throw new Error(`Unclosed XML tag: ${stack[stack.length - 1]}.`);
  return lines.join("\n");
}

/** Parses a query string or URL, keeping repeated keys as arrays. */
export function parseQueryString(input: string): QueryValues {
  ensureText(input, "Query string");
  const query = input.includes("?") ? input.slice(input.indexOf("?") + 1).split("#")[0] : input.replace(/^\?/, "");
  try {
    const result: QueryValues = {};
    for (const [key, value] of new URLSearchParams(query)) {
      const current = result[key]; result[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
    }
    return result;
  } catch { throw new Error("Invalid percent-encoded query string."); }
}

/** Converts a signed integer string between bases 2 and 36 using BigInt. */
export function convertNumberBase(value: string, fromBase: number, toBase: number): string {
  ensureText(value, "Number");
  if (!Number.isInteger(fromBase) || !Number.isInteger(toBase) || fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) throw new Error("Bases must be integers between 2 and 36.");
  const source = value.trim().toLowerCase(); if (!source || !/^-?[0-9a-z]+$/.test(source)) throw new Error("Number must be a signed integer.");
  const sign = source.startsWith("-") ? -1n : 1n; const digits = source.replace(/^-/, ""); let total = 0n;
  for (const digit of digits) { const n = BigInt(parseInt(digit, 36)); if (n >= fromBase) throw new Error(`Digit ${digit} is invalid for base ${fromBase}.`); total = total * BigInt(fromBase) + n; }
  return (sign * total).toString(toBase).toUpperCase();
}

/** Encodes UTF-8 text as space-separated eight-bit binary bytes. */
export function textToBinary(text: string): string { return Array.from(new TextEncoder().encode(ensureText(text, "Text"))).map(byte => byte.toString(2).padStart(8, "0")).join(" "); }

/** Decodes space-separated or continuous eight-bit UTF-8 binary into text. */
export function binaryToText(binary: string): string {
  const clean = ensureText(binary, "Binary").replace(/\s/g, "");
  if (!clean || !/^[01]+$/.test(clean) || clean.length % 8) throw new Error("Binary must contain complete 8-bit bytes.");
  const bytes = new Uint8Array(clean.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("Binary is not valid UTF-8 text."); }
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** RFC 4648 Base32 encodes UTF-8 text, with padding. */
export function base32Encode(text: string): string {
  const bytes = new TextEncoder().encode(ensureText(text, "Text")); let bits = 0, count = 0, output = "";
  for (const byte of bytes) { bits = (bits << 8) | byte; count += 8; while (count >= 5) { output += BASE32[(bits >> (count - 5)) & 31]; count -= 5; } }
  if (count) output += BASE32[(bits << (5 - count)) & 31]; return output.padEnd(Math.ceil(output.length / 8) * 8, "=");
}
/** Decodes padded or unpadded RFC 4648 Base32 into UTF-8 text. */
export function base32Decode(encoded: string): string {
  const source = ensureText(encoded, "Base32").trim().toUpperCase(); if (!source || !/^[A-Z2-7]*={0,6}$/.test(source) || /=.+[^=]/.test(source)) throw new Error("Invalid Base32 input.");
  const plain = source.replace(/=+$/, ""); let bits = 0, count = 0; const out: number[] = [];
  for (const char of plain) { bits = (bits << 5) | BASE32.indexOf(char); count += 5; if (count >= 8) { out.push((bits >> (count - 8)) & 255); count -= 8; } }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(out)); } catch { throw new Error("Base32 bytes are not valid UTF-8 text."); }
}

/** Returns deterministic Lorem Ipsum text. Paragraphs must be between 1 and 100. */
export function loremIpsum(paragraphs = 1, wordsPerParagraph = 48): string {
  if (!Number.isInteger(paragraphs) || paragraphs < 1 || paragraphs > 100 || !Number.isInteger(wordsPerParagraph) || wordsPerParagraph < 1 || wordsPerParagraph > 500) throw new Error("Paragraph and word counts must be sensible positive integers.");
  const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit voluptate velit esse cillum fugiat nulla pariatur".split(" ");
  return Array.from({ length: paragraphs }, (_, p) => Array.from({ length: wordsPerParagraph }, (_, i) => words[(p * wordsPerParagraph + i) % words.length]).join(" ").replace(/^./, x => x.toUpperCase()) + ".").join("\n\n");
}

/** Converts a safe Markdown subset (headings, emphasis, links, lists, code) to escaped HTML. */
export function markdownToHtml(markdown: string): string {
  ensureText(markdown, "Markdown");
  const inline = (line: string) => escapeForHtml(line).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); const out: string[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { out.push("<ul>" + list.map(x => `<li>${inline(x)}</li>`).join("") + "</ul>"); list = []; } };
  for (const line of lines) { const item = line.match(/^\s*[-*+]\s+(.+)$/); if (item) { list.push(item[1]); continue; } flush(); const heading = line.match(/^(#{1,6})\s+(.+)$/); if (heading) out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); else if (line.trim()) out.push(`<p>${inline(line)}</p>`); }
  flush(); return out.join("\n");
}
function escapeForHtml(value: string) { return value.replace(/[&<>\"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[char] || char)); }

/** Identifies common browser, OS and device families from a User-Agent string. */
export function parseUserAgent(ua: string): UserAgentInfo {
  ensureText(ua, "User-Agent"); if (!ua.trim()) throw new Error("User-Agent cannot be empty.");
  const version = (regex: RegExp) => ua.match(regex)?.[1] ?? null;
  const bot = /bot|crawler|spider|slurp/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Microsoft Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS\//.test(ua) ? "Chrome (iOS)" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Unknown";
  const browserVersion = browser.includes("Edge") ? version(/Edg\/([\d.]+)/) : browser === "Firefox" ? version(/Firefox\/([\d.]+)/) : browser.startsWith("Chrome") ? version(/(?:Chrome|CriOS)\/([\d.]+)/) : browser === "Safari" ? version(/Version\/([\d.]+)/) : null;
  const os = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS/iPadOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown";
  const device: UserAgentInfo["device"] = bot ? "bot" : /iPad|Tablet/.test(ua) ? "tablet" : /Mobi|Android/.test(ua) ? "mobile" : os === "Unknown" ? "unknown" : "desktop";
  return { browser: bot ? "Bot" : browser, browserVersion, os, device };
}

const HTTP_STATUSES: Record<number, string> = { 100:"Continue",101:"Switching Protocols",200:"OK",201:"Created",202:"Accepted",204:"No Content",301:"Moved Permanently",302:"Found",304:"Not Modified",400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",408:"Request Timeout",409:"Conflict",410:"Gone",413:"Content Too Large",415:"Unsupported Media Type",418:"I'm a teapot",422:"Unprocessable Content",429:"Too Many Requests",500:"Internal Server Error",501:"Not Implemented",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Timeout" };
/** Looks up a standard HTTP status. Unknown/invalid codes throw Error. */
export function lookupHttpStatus(code: number): { code: number; name: string; category: string } { if (!Number.isInteger(code) || !HTTP_STATUSES[code]) throw new Error("Unknown HTTP status code."); return { code, name: HTTP_STATUSES[code], category: `${Math.floor(code / 100)}xx` }; }

const MIME_TYPES: Record<string, string> = { txt:"text/plain",html:"text/html",htm:"text/html",css:"text/css",js:"text/javascript",mjs:"text/javascript",json:"application/json",xml:"application/xml",csv:"text/csv",pdf:"application/pdf",zip:"application/zip",gz:"application/gzip",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",mp3:"audio/mpeg",wav:"audio/wav",mp4:"video/mp4",webm:"video/webm",woff:"font/woff",woff2:"font/woff2" };
/** Looks up a common MIME type by filename or extension. */
export function lookupMimeType(filenameOrExtension: string): string { const key = ensureText(filenameOrExtension, "Filename").trim().toLowerCase().split(".").pop(); if (!key || !MIME_TYPES[key]) throw new Error("Unknown file extension."); return MIME_TYPES[key]; }

const ipToInt = (ip: string) => { const bits = ip.split("."); if (bits.length !== 4 || bits.some(x => !/^\d+$/.test(x) || Number(x) > 255)) throw new Error("IPv4 address must contain four octets from 0 to 255."); return bits.reduce((n, x) => (n << 8) + Number(x), 0) >>> 0; };
const intToIp = (n: number) => [24,16,8,0].map(shift => (n >>> shift) & 255).join(".");
/** Calculates IPv4 network details from CIDR notation such as 192.168.1.10/24. */
export function calculateSubnet(cidr: string): SubnetInfo {
  ensureText(cidr, "CIDR"); const match = cidr.trim().match(/^(.+)\/(\d{1,2})$/); if (!match) throw new Error("CIDR must look like 192.168.1.10/24."); const address = ipToInt(match[1]), prefix = Number(match[2]); if (prefix > 32) throw new Error("CIDR prefix must be between 0 and 32.");
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0, network = (address & mask) >>> 0, broadcast = (network | (~mask >>> 0)) >>> 0, total = 2 ** (32 - prefix), usable = prefix >= 31 ? 0 : total - 2;
  return { address: intToIp(address), prefix, mask: intToIp(mask), network: intToIp(network), broadcast: intToIp(broadcast), firstHost: usable ? intToIp(network + 1) : null, lastHost: usable ? intToIp(broadcast - 1) : null, totalAddresses: total, usableHosts: usable };
}

/** Estimates download time from bytes and connection Mbps. */
export function estimateDownloadTime(bytes: number, megabitsPerSecond: number): DownloadEstimate { if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(megabitsPerSecond) || megabitsPerSecond <= 0) throw new Error("Bytes must be non-negative and Mbps must be greater than zero."); const seconds = bytes * 8 / (megabitsPerSecond * 1_000_000); return { seconds, human: seconds < 60 ? `${seconds.toFixed(1)} seconds` : `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s` }; }

/** Validates newline-delimited JSON and returns each parsed value. Blank lines are ignored. */
export function validateJsonLines(jsonl: string): unknown[] { ensureText(jsonl, "JSONL"); const values: unknown[] = []; jsonl.replace(/\r\n?/g, "\n").split("\n").forEach((line, index) => { if (!line.trim()) return; try { values.push(JSON.parse(line)); } catch (error) { throw new Error(`Invalid JSON on line ${index + 1}: ${(error as Error).message}`); } }); if (!values.length) throw new Error("JSONL must contain at least one JSON value."); return values; }

/** A transparent heuristic token estimate suitable for sizing prompts, not billing. */
export function estimateTokens(text: string): { tokens: number; method: string } { const value = ensureText(text, "Text"); if (!value) return { tokens: 0, method: "0 tokens for empty input" }; const cjk = (value.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length; const other = value.length - cjk; return { tokens: Math.ceil(cjk * 1.5 + other / 4), method: "heuristic: ~1 token per 4 non-CJK characters; ~1.5 per CJK character" }; }

/** Redacts common emails, phone numbers, IPv4 addresses, payment-card numbers and Bearer tokens. */
export function redactPii(text: string, replacement = "[REDACTED]"): string {
  ensureText(text, "Text"); ensureText(replacement, "Replacement"); if (!replacement) throw new Error("Replacement cannot be empty.");
  return text.replace(/\bBearer\s+[A-Za-z0-9._~+\-/]+=*\b/gi, `Bearer ${replacement}`).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement).replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement).replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, replacement).replace(/\b(?:\d[ -]*?){13,19}\b/g, replacement);
}
