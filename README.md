# Integ Tools

Privacy-first browser utilities and practical calculators for
[tools.integ.life](https://tools.integ.life). The site is fully static, runs
tool inputs locally, and publishes 448 indexable pages in English, Chinese,
Spanish, Hindi, Arabic, Japanese, and Indonesian.

## Development

```bash
npm install
npm run dev
npm test
npm run lint
```

`npm run build` writes the GitHub Pages artifact to `dist/`, including localized
HTML, canonical and hreflang metadata, JSON-LD, sitemap, robots, CNAME, and the
404 fallback. Pushes to `main` deploy through `.github/workflows/pages.yml`.

## Page analytics

Production uses the **Integ Tools** GA4 property and the
`tools.integ.life — Production` web stream (`G-G9R5B7MNQX`). Enhanced
measurement is disabled in GA. Only public catalog/tool paths are reported;
query strings, fragments, referrers, tool inputs, results and arbitrary paths
are excluded. Pageviews cover initial loads and browser history navigation,
with duplicate paths suppressed. Local, preview and embedded pages do not load
the Google tag. Ad personalization and Google signals are disabled.
