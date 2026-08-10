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
