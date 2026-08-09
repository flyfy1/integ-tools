import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { tools } from "../src/tools.ts";
import { locales, copy } from "../src/i18n.ts";
import { localizedDescription, localizedName } from "../src/toolLocales.ts";

const base="https://tools.integ.life";
const template=await readFile("dist/index.html","utf8");
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const pages=[];
for(const locale of locales){
 for(const tool of [null,...tools]){
  const slug=tool?.slug||""; const path=`/${locale}/${slug}`.replace(/\/$/,"")+"/"; pages.push(path);
  const name=tool?localizedName(tool,locale):copy[locale].name;
  const desc=tool?localizedDescription(tool,locale):copy[locale].intro; const canonical=base+path;
  const alternates=locales.map(l=>`<link rel="alternate" hreflang="${l}" href="${base}/${l}/${slug?slug+"/":""}" />`).join("\n    ");
  const schema={"@context":"https://schema.org","@type":tool?"WebApplication":"WebSite",name,description:desc,url:canonical,applicationCategory:tool?.category==="finance"?"FinanceApplication":"DeveloperApplication",operatingSystem:"Any",offers:{"@type":"Offer",price:"0",priceCurrency:"USD"}};
  let html=template.replace(/<html lang="en">/,`<html lang="${locale}" dir="${locale==="ar"?"rtl":"ltr"}">`).replace(/<title>.*?<\/title>/,`<title>${esc(name)} — ${esc(copy[locale].name)}</title>`).replace(/<meta name="description" content="[^"]*" \/>/,`<meta name="description" content="${esc(desc)}" />`).replace(/<link rel="canonical" href="[^"]*" \/>/,`<link rel="canonical" href="${canonical}" />`).replace(/<link rel="alternate"[\s\S]*?<link rel="alternate" hreflang="ar"[^>]*\/>/,alternates).replace("</head>",`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\u003c")}</script>\n  </head>`);
  const dir=`dist${path}`; await mkdir(dir,{recursive:true}); await writeFile(dir+"index.html",html);
 }
}
await writeFile("dist/sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${base}${p}</loc><changefreq>monthly</changefreq></url>`).join("")}</urlset>`);
await writeFile("dist/robots.txt",`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
await writeFile("dist/CNAME","tools.integ.life\n"); await writeFile("dist/.nojekyll","");
await writeFile("dist/404.html",template.replace("</head>",`<script>sessionStorage.redirect=location.pathname;location.replace('/en/')</script></head>`));
try{await copyFile("public/og.png","dist/og.png")}catch{}
console.log(`Generated ${pages.length} localized pages`);
