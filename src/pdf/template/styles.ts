import sansExt from '@fontsource-variable/noto-sans/files/noto-sans-latin-ext-wght-normal.woff2?inline'
import sansLatin from '@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2?inline'
import serifLatin from '@fontsource-variable/noto-serif/files/noto-serif-latin-wght-normal.woff2?inline'
import { theme } from './theme'

/*
 * Self-contained CSS for the CV document. Fonts are embedded as data: URIs so the sandboxed
 * preview iframe and the offline Chromium renderer never fetch anything. Never interpolate CV data here.
 */

const { color: c, size: s, page: p } = theme

// Unicode ranges copied from @fontsource-variable/*/wght.css.
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

const face = (family: string, src: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-display:block;font-weight:100 900;src:url(${src}) format('woff2');unicode-range:${range}}`

const FONTS = [
  face('CV Sans', sansLatin, LATIN),
  face('CV Sans', sansExt, LATIN_EXT),
  face('CV Serif', serifLatin, LATIN),
].join('\n')

const BASE = `
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'CV Sans', 'Noto Sans', Arial, sans-serif; font-size: ${s.body}; line-height: 1.45; color: ${c.ink}; background: ${c.white}; }
h1, h2, h3, p, ul, blockquote, figure { margin: 0; padding: 0; }
ul { list-style: none; }
h1, h2, h3 { font-weight: 300; letter-spacing: -0.02em; line-height: 1.15; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
.serif { font-family: 'CV Serif', 'Noto Serif', Georgia, serif; font-weight: 300; letter-spacing: -0.01em; }
.muted { color: ${c.muted}; }

.page { background: ${c.white}; }
.page--cover { break-after: page; display: flex; flex-direction: column; }
.page--body { padding: 0 ${p.marginX}; }

/* Cover band: the deep forest green of the kipina.fi hero. */
.band { color: ${c.white}; padding: 14mm ${p.marginX} 12mm;
  background: radial-gradient(60% 90% at 80% 15%, rgb(76 93 54 / 0.6), transparent 70%),
    radial-gradient(55% 80% at 5% 100%, rgb(0 109 94 / 0.4), transparent 70%), ${c.forestDeep}; }
.band__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16mm; }
.logo-chip { background: ${c.white}; border-radius: 3px; padding: 2.2mm 3mm; display: inline-flex; }
.logo-chip img { height: 7mm; width: auto; display: block; }
.band__eyebrow { font-size: ${s.small}; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(255 255 255 / 0.8); }
.band h1 { font-size: ${s.name}; letter-spacing: -0.035em; line-height: 1.02; }
.band__label { margin-top: 3mm; font-size: ${s.label}; font-weight: 300; }
.band__summary { margin-top: 2mm; display: inline-block; padding-bottom: 1mm; border-bottom: 2px solid ${c.lime}; font-size: ${s.body}; font-weight: 500; }
.band__tagline { margin-top: 7mm; font-size: 15pt; line-height: 1.3; color: rgb(255 255 255 / 0.92); max-width: 150mm; }
.band__contact { margin-top: 6mm; display: flex; flex-wrap: wrap; gap: 1mm 6mm; font-size: ${s.small}; color: rgb(255 255 255 / 0.88); }

.cover-body { padding: 10mm ${p.marginX} 12mm; display: flex; flex-direction: column; gap: 8mm; flex: 1; }
.lede { font-size: ${s.lead}; line-height: 1.5; max-width: 170mm; }

.section { margin-top: 12mm; padding-top: 2.5mm; border-top: 1.5px solid ${c.ink}; }
.section:first-child { margin-top: 0; }
.cover-body .section { margin-top: 0; }
.section > h2 { font-size: ${s.h2}; margin-bottom: 6mm; }
.section--minor > h2 { font-size: ${s.label}; margin-bottom: 3mm; }
.grid-mark { display: grid; grid-template-columns: repeat(3, 1.1mm); gap: 0; flex: none; }
.grid-mark span { width: 1.1mm; height: 1.1mm; display: block; }

.entries > .entry + .entry { margin-top: 6mm; }
.compact .entries > .entry + .entry { margin-top: 3.5mm; }
.entry { break-inside: avoid; display: grid; grid-template-columns: ${p.rail} 1fr; gap: ${p.gutter}; }
.entry__aside { font-size: ${s.small}; color: ${c.muted}; font-variant-numeric: tabular-nums; padding-top: 0.6mm; }
.entry__aside h3 { font-size: ${s.h3}; font-weight: 500; letter-spacing: -0.01em; color: ${c.ink}; }

.strengths { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 10mm; }
.strengths li { break-inside: avoid; }
.strengths h3 { font-size: ${s.label}; }
.strengths p { margin-top: 1.5mm; color: ${c.muted}; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
.item-list li { break-inside: avoid; padding: 1.2mm 0; }
.item-list strong { display: block; font-weight: 500; }
.item-list .muted { display: block; }
strong { font-weight: 500; }

.inline-list { display: flex; flex-wrap: wrap; }
.inline-list li:not(:last-child)::after { content: '·'; margin: 0 1.8mm; color: ${c.muted}; }

.quote { break-inside: avoid; padding-left: calc(${p.rail} + ${p.gutter}); }
.quote::before { content: ''; display: block; width: 12mm; height: 1.2mm; background: ${c.lime}; margin-bottom: 4mm; }
.quote p { font-size: 14pt; line-height: 1.35; text-indent: -0.42em; max-width: 125mm; }
.quote cite { display: block; margin-top: 2.5mm; font-style: normal; font-size: ${s.small}; color: ${c.muted}; }
.hobbies { font-size: ${s.body}; color: ${c.muted}; padding-left: calc(${p.rail} + ${p.gutter}); }

/* Projects */
.project h3 { font-size: 14pt; font-weight: 300; letter-spacing: -0.02em; }
.project__meta { margin-top: 1mm; display: flex; flex-wrap: wrap; font-size: ${s.small}; color: ${c.muted}; }
.project__meta > :not(:last-child)::after { content: '·'; margin: 0 1.6mm; }
.project__meta strong { color: ${c.teal}; font-weight: 600; }
.project p { margin-top: 2mm; max-width: 125mm; }
.project .inline-list { margin-top: 2mm; font-size: ${s.small}; color: ${c.muted}; }
.compact .project h3 { font-size: ${s.h3}; font-weight: 500; letter-spacing: -0.01em; }
.compact .project p { margin-top: 1mm; }

/* Skills */
.skill-list { display: flex; flex-wrap: wrap; gap: 1mm 5mm; }
.years { font-size: ${s.small}; color: ${c.muted}; font-variant-numeric: tabular-nums; }
.skill-list + .inline-list { margin-top: 1.5mm; color: ${c.muted}; }

.pairs { display: flex; flex-wrap: wrap; gap: 1mm 8mm; }

.colophon { margin-top: 12mm; padding-top: 3mm; border-top: 1px solid ${c.line}; font-size: ${s.small}; color: ${c.muted}; display: flex; align-items: center; gap: 2mm; }

@media screen {
  html { background: ${c.mist}; }
  body { background: ${c.mist}; padding: 8mm 0; }
  .page { width: var(--page-width); margin: 0 auto 8mm; box-shadow: 0 0 0 1px ${c.line}, 0 1px 3px rgb(43 43 43 / 0.08); }
  .page--cover { min-height: var(--page-height); }
  .page--body { padding: ${p.marginTop} ${p.marginX} ${p.marginBottom}; min-height: var(--page-height); }
}
`

/* Pages are full-bleed sideways (horizontal padding lives on the content). Only the first page
   drops its top margin so the cover band touches the edge; overflow pages keep normal margins. */
const PORTRAIT = `
@page { size: A4 portrait; margin: ${p.marginTop} 0 ${p.marginBottom}; }
@page :first { margin-top: 0; }
:root { --page-width: 210mm; --page-height: 297mm; }
`

/* Keep the band one page tall: stretching it with the grid row repeats it on the cover's overflow page. */
const LANDSCAPE = `
@page { size: A4 landscape; margin: ${p.marginTop} 0 ${p.marginBottom}; }
@page :first { margin: 0; }
:root { --page-width: 297mm; --page-height: 210mm; }

.page--cover { display: grid; grid-template-columns: 105mm 1fr; align-items: start; min-height: var(--page-height); }
.band { height: var(--page-height); padding: 14mm 10mm 14mm ${p.marginX}; }
.band h1 { font-size: 40pt; }
.band__tagline { max-width: none; }
.cover-body { padding: 14mm ${p.marginX} 12mm 12mm; gap: 7mm; }

.page--body .section { display: grid; grid-template-columns: 52mm 1fr; column-gap: ${p.gutter}; }
.page--body .section > h2 { margin-bottom: 0; }
.page--body .section > :not(h2) { grid-column: 2; }
`

export const PORTRAIT_STYLES = `${FONTS}\n${BASE}\n${PORTRAIT}`
export const LANDSCAPE_STYLES = `${FONTS}\n${BASE}\n${LANDSCAPE}`
