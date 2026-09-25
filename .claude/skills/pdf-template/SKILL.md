---
name: pdf-template
description: Use when changing the CV PDF look or layout, the template components under src/pdf (CvDocument, theme.ts, fonts), the Chromium render pipeline (src/server/pdf/render.ts, pdf-lib post-processing, cv.json attachment), or PDF export options and file naming. Covers design rules, print CSS, security of the renderer and the tests that must pass.
---

# PDF template and pipeline

Source of truth: `spec.md` §7.7 (PDF), §9 (security), §10 (a11y), §15 D3 (why Chromium). The PDF
is the product's main output: it must look like **Kipinä** (distinctive, not a generic template or
AI filler), be skimmable in 30 seconds, and be machine-readable, because clients vet CVs with AI.

## 1. Design principles

- **Hierarchy first.** A reader should see name → label → "In a nutshell" → key roles/skills
  before anything else. One H1 (name), H2 per section, H3 per project/role.
- **Real type scale** from `theme.ts` (e.g. 9.5 / 11 / 14 / 20 / 32 pt), not ad-hoc sizes. Body
  ≥ 9pt, line-height ~1.4, measure ≤ ~80 characters.
- **One accent color**, used sparingly (the cover summary underline, the quote marker). Everything else is
  ink + neutral grays. No gradients, drop shadows, stock icons, emojis or clip-art.
- **Consistent grid**: fixed page margins, one column gutter, spacing only from `theme.space.*`.
  Generous whitespace beats cramming; cut content (max-projects option) before shrinking type.
- **Editorial grid, not boxes**: a narrow left rail (dates, group names) and a wide content
  column. One ink rule per section, no dividers between items, no left accent borders, no
  meter bars, no pill chips. Keywords are inline text lists separated by middle dots.
- **Concrete content.** The template never adds filler ("passionate team player"); empty sections
  are omitted, not padded. Wording belongs to the CV data, not the template.
- **Brand:** follow the `kipina-brand` skill (palette and type taken from kipina.fi). Tokens live
  in `src/pdf/template/theme.ts` and mirror `src/styles/app.css`. The logo is
  `public/brand/kipina-logo.png` (taken from kipina.fi; SVG masters are still wanted from a human).
  Never invent brand elements.
- **Fonts:** Noto Sans / Noto Serif (OFL) from `@fontsource-variable/*`, imported with `?inline` in
  `src/pdf/template/styles.ts` and embedded as `data:` URIs. **Never** link Google Fonts or any CDN.

## 2. Template structure

`<CvDocument cv options />` in `src/pdf/template/` is a **pure** React component (props in, markup
out; no hooks with effects, no fetch, no Date.now — pass `generatedAt` in `options`). The same
component renders the live preview (`<iframe sandbox srcdoc>`, no `allow-scripts`) and the PDF, so
the preview is the PDF. Small components per section, each ≤ 300 lines, reading from `cv` only.

Section order (spec §7.7, follows today's PowerPoint CV):
1. **Profile page**: name (H1), `basics.label`, `x-experienceSummary`, `x-tagline`,
   **In a nutshell** (`x-strengths` title + description), `x-keyRoles`, `x-keySkills`,
   `x-keywords` and `x-industries` as chips, one `x-testimonials` quote. Contact only if
   `options.includeContact`.
2. **Project highlights**: `projects` with `x-highlight: true` — name, client (`entity`),
   `x-industry`, roles, dates, technologies (`keywords`).
3. **Skills**: `skills[]` categories; per-technology years (`x-skillDetails`) as a text label
   next to the name ("Kotlin 6 yrs"), never bars.
4. **Project history**, **Work history**, **Education & certificates**, **Languages**.

Dates: render `startDate–endDate` ("2019–2022", missing end = "present"); fall back to
`x-dateText` / `x-duration`; if none, render nothing (no "n/a"). Respect `options.sections` and
`options.maxProjects` (highlights always first, then by date).

## 3. Print CSS rules

```css
@page { size: A4; margin: 18mm 16mm 20mm; }
html { -webkit-print-color-adjust: exact; }
.project, .role, blockquote { break-inside: avoid; }
h2, h3 { break-after: avoid; }
p, li { orphans: 3; widows: 3; }
```
- `<html lang={cv.meta.language ?? 'en'}>` and a `<title>` (becomes PDF title fallback).
- **DOM order = reading order.** No `order:`, `flex-direction: *-reverse`, `grid-area` reordering,
  absolute/fixed-positioned text, or CSS multi-column for running text. A side column is fine only
  if it comes first or last in the DOM and reads sensibly on its own.
- Real headings (`h1/h2/h3`, no skipped levels), lists as `ul/li`, quotes as `blockquote`+`cite`.
- Logo `<img alt="Kipinä">` (or `<svg role="img"><title>`); decorative SVG gets `aria-hidden="true"`.
- Contrast ≥ 4.5:1 for text (including chips on tint); highlight is marked with a text label or
  heading, not only color. No text inside images.
- Running footer (name · "Kipinä CV" · page N / M) via `page.pdf({ displayHeaderFooter: true,
  footerTemplate })` using `<span class="pageNumber">`/`totalPages`; its styles are inline in the
  template string and it contains no CV free text except the escaped name.

## 4. Render pipeline (`src/server/pdf/render.ts`)

```ts
const html = '<!doctype html>' + renderToStaticMarkup(<CvDocument cv={cv} options={opts} />);
await semaphore.acquire();                        // max PDF_MAX_CONCURRENCY (2)
const context = await getBrowser().newContext({ javaScriptEnabled: false, offline: true });
try {
  await context.route('**/*', (route) => route.abort()); // data: URIs are not requests
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.setContent(html, { waitUntil: 'load' });
  return await page.pdf({
    format: 'A4', printBackground: true, preferCSSPageSize: true,
    tagged: true, outline: true, displayHeaderFooter: true, footerTemplate, headerTemplate: '<span></span>',
  });
} finally {
  await context.close();
  semaphore.release();
}
```
- React escapes everything. **No `dangerouslySetInnerHTML`**, no string-concatenated HTML (lint).
- One lazily started shared browser; relaunch on `disconnected`. Whole render wrapped in a 15 s
  timeout that returns `Result` error `INTERNAL`, never hangs the request.
- Never log CV content or HTML; log `cvId`, revision id, duration, byte size, requestId.

## 5. Post-processing (pdf-lib)

```ts
const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
doc.setTitle(`${cv.basics.name} – ${cv.basics.label} – Kipinä CV`, { showInWindowTitleBar: true });
doc.setAuthor('Kipinä'); doc.setSubject(cv.basics['x-experienceSummary'] ?? 'Consultant CV');
doc.setKeywords(topSkills(cv, 10)); doc.setLanguage(cv.meta.language ?? 'en');
doc.setCreator('Kipinä CV bank'); doc.setCreationDate(now); doc.setModificationDate(now);
const json = new TextEncoder().encode(JSON.stringify(toExportJson(cv, opts), null, 2));
await doc.attach(json, 'cv.json', {
  mimeType: 'application/json', description: 'JSON Resume 1.0 export of this CV',
  creationDate: now, modificationDate: now,
});
return doc.save();
```
`toExportJson` is a pure function in `src/cv/`: it always removes `meta.x-conversionNotes`, and
removes `basics.email/phone/url/location/profiles` unless `includeContact`. It also drops sections
excluded by `options.sections` so the attachment matches the visible PDF. Check that saving with
pdf-lib keeps the StructTreeRoot (test below).

## 6. Export options and file name

- Zod `ExportOptions`: `includeContact` (default **false**), `sections` (subset, default all),
  `maxProjects` (1..200). Validated server-side on the route; audit `export` + options.
- The template (page size and layout) isn't an export option: it comes from the CV's
  `meta.x-template` through the registry in `src/pdf/template/templates.ts`. To add a template,
  add its id to `CV_TEMPLATE_IDS` in `src/cv/schema.ts` and `cv.schema.json`, then add its
  registry entry: label, preview width, styles with their own `@page`, a `Layout` component,
  and a `content` function. Layouts reuse the section components; keep one H1 first and DOM
  order = reading order. A `content` function that drops data also drops it from `cv.json`.
  To remove a template, delete its entry and id; saved CVs that use it then fail validation,
  so move them to another template first.
- File name `Kipina_CV_<First>_<Last>_<variant>_<YYYY-MM-DD>.pdf`: NFKD-fold to ASCII, keep
  `[A-Za-z0-9-]`, collapse to `_`, cap length; send via RFC 6266 (`filename=` + `filename*=UTF-8''`).
  Unit test with "Mäkinen", quotes, slashes, `..`, CRLF and emoji.

## 7. Tests that must exist

`tests/integration/pdf.test.ts` (real Chromium, pdfjs-dist):
- Text from `getTextContent()` across pages contains name, label, every highlighted project name
  and skill names **in DOM order** (assert index ordering), and "ä ö å –" round-trip.
- `page.getStructTree()` is non-null on page 1 and contains H1 and H2 roles; document lang set.
- Attachment `cv.json` exists (`getAttachments()`), parses and validates with `CvDocument` Zod;
  has no `x-conversionNotes`; has no email/phone when `includeContact` is false.
- Metadata Title/Author/Keywords set. Renderer blocks network: a CV whose text contains
  `<img src="http://…">` renders as literal text and triggers no request.
Unit: `toExportJson`, file-name sanitizer, date formatting, section/maxProjects selection.
E2E/a11y: `@axe-core/playwright` on the preview HTML (serious/critical fail, includes contrast).

**Visual regression**: Playwright `expect(page).toHaveScreenshot()` on the preview HTML rendered
at A4 width, `emulateMedia({ media: 'print' })`, for three fixtures:
short (`p26-v1`, 6 projects), long (`p10-v1`, 20 projects), and no-dates (a `buildCv()` factory CV
where projects have neither dates nor `x-dateText`). Fonts are embedded, so snapshots are stable.

**Reviewing visual changes**: run `pnpm test:e2e --grep visual`, open the HTML report and inspect
the diff images; also render the three PDFs locally and read them at 100% and as thumbnails
(skimmability). Update snapshots (`--update-snapshots`) only after a deliberate design change, and
mention it in the commit. When in doubt about brand fit, ask a human with the reference CV.
