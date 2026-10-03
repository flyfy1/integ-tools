# Integ Tools

Privacy-first browser utilities and practical calculators for
[tools.integ.life](https://tools.integ.life). The site is fully static, runs
tool inputs locally, and publishes 462 indexable pages in English, Chinese,
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

## Component camera reader

Open `/zh/component-scanner/` or `/en/component-scanner/` on a phone over HTTPS.
Select the component type, allow the rear camera, and align a
single roughly horizontal component near the middle. A local color/geometry
detector searches the frame, follows the painted body and shows a magnified crop.
Resistor scanning detects 4 or 5 bands automatically without restarting the camera.
The reader samples the located body every 450 ms and requires three matching frames before
displaying a candidate. Pause to inspect or correct colors. Both directions are
shown when the code is ambiguous. Camera tracks stop on pause, navigation, or
when the page becomes hidden; frames are never uploaded or saved.

This experimental reader supports 4/5-band resistors, 4-band EIA inductors and
5-band MIL inductors (with a wide silver identifier). It reads marked nominal
values and tolerance, not actual measurements or component type. It does not
scan SMD text, 6-band resistors or unmarked parts. Lighting, glare, body paint
and similar colors can cause incorrect candidates. Verify colors and use a
meter for critical values. Dim bands are marked for review; an uncertain tolerance
color does not produce a definite percentage in the camera result. Code tables follow the linked Vishay and Bourns
references on the tool page. Automated camera tests use controlled pixels and
mock media streams; real phone optics still need physical-component validation.

The optional **Debug / report a recognition problem** flow previews a selected
photo and submits it with explicit consent to shared Integ Feedback. It imports
the service-owned SDK from `https://discuss.integ.life/v1/feedback/client.js`.
Compression, validation, private storage, retention, receipts and operator export
are maintained in `integ-life/integ-feedback` for other projects to reuse.
Opening Debug or selecting an image does not upload it. Reports include the
selected type, band count, colors, candidate values and optional description.

The [color-code and measurement guide](https://tools.integ.life/zh/component-scanner/#component-guide)
below the reader explains resistance/inductance units, nominal values and tolerance,
reading direction, supported EIA/MIL layouts, a shared color table, and instrument
measurement. Five illustrated examples can be loaded into the manual reader.
Chinese and English guidance includes manufacturer and instrument references.
