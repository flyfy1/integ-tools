import { base32Decode, base32Encode, binaryToText, calculateSubnet, convertNumberBase, estimateDownloadTime, estimateTokens, formatSql, formatXml, getJsonPath, jsonToTypeScript, loremIpsum, lookupHttpStatus, lookupMimeType, markdownToHtml, parseQueryString, parseUserAgent, redactPii, textToBinary, validateJsonLines } from "./developer.ts";

export type EngineInput = { input: string; secondary: string; option: string };
export type EngineDefinition = { example: string; secondaryExample?: string; options?: string[]; secondaryLabel?: string; run: (input: EngineInput) => string | Promise<string> };
const json = (value: unknown) => JSON.stringify(value, null, 2);

export const developerEngines: Record<string, EngineDefinition> = {
  "json-typescript": { example: '{"id":1,"name":"Ada","roles":["admin"]}', secondaryExample: "ApiResponse", secondaryLabel: "Root type name", run: ({ input, secondary }) => jsonToTypeScript(input, secondary || "Root") },
  jsonpath: { example: '{"users":[{"name":"Ada"},{"name":"Lin"}]}', secondaryExample: "$.users[*].name", secondaryLabel: "JSONPath", run: ({ input, secondary }) => json(getJsonPath(JSON.parse(input), secondary || "$")) },
  jsonl: { example: '{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi"}', run: ({ input }) => `${validateJsonLines(input).length} valid JSON lines` },
  sql: { example: "select id,name from users where active=true order by name", run: ({ input }) => formatSql(input) },
  xml: { example: "<catalog><book id=\"1\"><title>Integ</title></book></catalog>", options: ["format", "minify"], run: ({ input, option }) => option === "minify" ? formatXml(input).replace(/>\s+</g, "><") : formatXml(input) },
  querystring: { example: "https://example.com/?utm_source=newsletter&tag=tools&tag=privacy", run: ({ input }) => json(parseQueryString(input)) },
  numberbase: { example: "255", secondaryExample: "10", secondaryLabel: "Source base", options: ["2", "8", "10", "16", "36"], run: ({ input, secondary, option }) => convertNumberBase(input, Number(secondary || 10), Number(option || 16)) },
  binarytext: { example: "Hello, 世界", options: ["encode", "decode"], run: ({ input, option }) => option === "decode" ? binaryToText(input) : textToBinary(input) },
  base32: { example: "Hello, 世界", options: ["encode", "decode"], run: ({ input, option }) => option === "decode" ? base32Decode(input) : base32Encode(input) },
  lorem: { example: "3", secondaryExample: "48", secondaryLabel: "Words per paragraph", run: ({ input, secondary }) => loremIpsum(Number(input || 3), Number(secondary || 48)) },
  markdown: { example: "# Private tools\n\nUse **Markdown** with a [safe link](https://tools.integ.life).", run: ({ input }) => markdownToHtml(input) },
  useragent: { example: typeof navigator === "undefined" ? "Mozilla/5.0 Chrome/120.0 Safari/537.36" : navigator.userAgent, run: ({ input }) => json(parseUserAgent(input)) },
  httpstatus: { example: "429", run: ({ input }) => json(lookupHttpStatus(Number(input))) },
  mime: { example: "report.json", run: ({ input }) => lookupMimeType(input) },
  subnet: { example: "192.168.1.10/24", run: ({ input }) => json(calculateSubnet(input)) },
  downloadtime: { example: "1024", secondaryExample: "100", secondaryLabel: "Connection speed (Mbps)", run: ({ input, secondary }) => json(estimateDownloadTime(Number(input) * 1024 * 1024, Number(secondary))) },
  tokens: { example: "Estimate how much context this multilingual prompt may use. 你好，世界。", run: ({ input }) => json(estimateTokens(input)) },
  redactor: { example: "Email ada@example.com, call +1 (415) 555-0123, server 192.168.1.10, Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature", run: ({ input }) => redactPii(input) },
};

export const getDeveloperEngine = (kind: string) => developerEngines[kind];
