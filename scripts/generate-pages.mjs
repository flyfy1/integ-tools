import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { tools } from "../src/tools.ts";
import { locales, copy } from "../src/i18n.ts";
import { localizedDescription, localizedName } from "../src/toolLocales.ts";

const base="https://tools.integ.life";
const template=await readFile("dist/index.html","utf8");
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const pages=[];
const modified=new Date().toISOString().slice(0,10);
for(const locale of locales){
 for(const tool of [null,...tools]){
  const slug=tool?.slug||""; const path=`/${locale}/${slug}`.replace(/\/$/,"")+"/"; pages.push(path);
  const name=tool?localizedName(tool,locale):copy[locale].name;
  const desc=tool?localizedDescription(tool,locale):copy[locale].intro; const canonical=base+path;
  const alternates=locales.map(l=>`<link rel="alternate" hreflang="${l}" href="${base}/${l}/${slug?slug+"/":""}" />`).join("\n    ");
  const keywords=tool?[tool.name,...tool.keywords,tool.category==="finance"?"online calculator":"online developer tool","free","browser-based"].join(", "):"online tools, developer tools, financial calculators, browser utilities";
  const faq=tool?[{"@type":"Question",name:`What does ${name} do?`,acceptedAnswer:{"@type":"Answer",text:desc}},{"@type":"Question",name:`Is ${name} private?`,acceptedAnswer:{"@type":"Answer",text:"Yes. Inputs are processed locally in your browser and are not uploaded to our servers."}}]:[];
  const graph=[{"@type":tool?"WebApplication":"WebSite","@id":`${canonical}#app`,name,description:desc,url:canonical,inLanguage:locale,dateModified:modified,applicationCategory:tool?.category==="finance"?"FinanceApplication":"DeveloperApplication",operatingSystem:"Any",browserRequirements:"Requires JavaScript",keywords,offers:{"@type":"Offer",price:"0",priceCurrency:"USD"}},...(tool?[{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:copy[locale].name,item:`${base}/${locale}/`},{"@type":"ListItem",position:2,name,item:canonical}]},{"@type":"FAQPage",mainEntity:faq}]:[])];
  const schema={"@context":"https://schema.org","@graph":graph};
  const fallback=tool?`<noscript><main><h1>${esc(name)}</h1><p>${esc(desc)}</p><p>${esc(tool.about)}</p><a href="/${locale}/">${esc(copy[locale].name)}</a></main></noscript>`:"";
  let html=template.replace(/<html lang="en">/,`<html lang="${locale}" dir="${locale==="ar"?"rtl":"ltr"}">`).replace(/<title>.*?<\/title>/,`<title>${esc(name)} — ${esc(copy[locale].name)}</title>`).replace(/<meta name="description" content="[^"]*" \/>/,`<meta name="description" content="${esc(desc)}" />\n    <meta name="keywords" content="${esc(keywords)}" />`).replace(/<link rel="canonical" href="[^"]*" \/>/,`<link rel="canonical" href="${canonical}" />`).replace(/<link rel="alternate"[\s\S]*?<link rel="alternate" hreflang="id"[^>]*\/>/,`${alternates}\n    <link rel="alternate" hreflang="x-default" href="${base}/en/${slug?slug+"/":""}" />`).replace(/<meta property="og:title" content="[^"]*" \/>/,`<meta property="og:title" content="${esc(name)}" />`).replace(/<meta property="og:description" content="[^"]*" \/>/,`<meta property="og:description" content="${esc(desc)}" />`).replace(/<meta name="twitter:title" content="[^"]*" \/>/,`<meta name="twitter:title" content="${esc(name)}" />`).replace(/<meta name="twitter:description" content="[^"]*" \/>/,`<meta name="twitter:description" content="${esc(desc)}" />`).replace("</head>",`<meta property="og:url" content="${canonical}" />\n    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\u003c")}</script>\n  </head>`).replace('<div id="root"></div>',`<div id="root"></div>${fallback}`);
  const dir=`dist${path}`; await mkdir(dir,{recursive:true}); await writeFile(dir+"index.html",html);
 }
}
await writeFile("dist/sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${base}${p}</loc><lastmod>${modified}</lastmod><changefreq>monthly</changefreq><priority>${/^\/[a-z]{2}\/$/.test(p)?"1.0":"0.8"}</priority></url>`).join("")}</urlset>`);
await writeFile("dist/robots.txt",`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
await writeFile("dist/CNAME","tools.integ.life\n"); await writeFile("dist/.nojekyll","");
await writeFile("dist/404.html",template.replace("</head>",`<script>sessionStorage.redirect=location.pathname;location.replace('/en/')</script></head>`));
try{await copyFile("public/og.png","dist/og.png")}catch{}
console.log(`Generated ${pages.length} localized pages`);
