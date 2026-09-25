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
/* Pages are full-bleed sideways (horizontal padding lives on the content). Only the first page
   drops its top margin so the cover band touches the edge; overflow pages keep normal margins. */
@page { size: A4; margin: ${p.marginTop} 0 ${p.marginBottom}; }
@page :first { margin-top: 0; }
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
.band h1 { font-size: ${s.name}; letter-spacing: -0.03em; }
.band__label { margin-top: 3mm; font-size: ${s.label}; font-weight: 300; }
.band__summary { margin-top: 2mm; display: inline-block; padding-bottom: 1mm; border-bottom: 2px solid ${c.lime}; font-size: ${s.body}; font-weight: 500; }
.band__tagline { margin-top: 7mm; font-size: 15pt; line-height: 1.3; color: rgb(255 255 255 / 0.92); max-width: 150mm; }
.band__contact { margin-top: 6mm; display: flex; flex-wrap: wrap; gap: 1mm 6mm; font-size: ${s.small}; color: rgb(255 255 255 / 0.88); }

.cover-body { padding: 10mm ${p.marginX} 12mm; display: flex; flex-direction: column; gap: 8mm; flex: 1; }
.lede { font-size: ${s.lead}; line-height: 1.5; max-width: 170mm; }

/* Section headings with the 3×3 grid marker. */
.section { margin-top: 9mm; }
.section:first-child { margin-top: 0; }
.cover-body .section { margin-top: 0; }
.section__head { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1px solid ${c.line}; }
.section__head h2 { font-size: ${s.h2}; }
.grid-mark { display: grid; grid-template-columns: repeat(3, 1.1mm); gap: 0; flex: none; }
.grid-mark span { width: 1.1mm; height: 1.1mm; display: block; }

.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm 8mm; }
.card { break-inside: avoid; }
.card h3 { font-size: ${s.h3}; font-weight: 500; letter-spacing: -0.01em; }
.card p { margin-top: 1mm; }
.card--bar { padding-left: 3mm; border-left: 2px solid ${c.lime}; }

.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(80mm, 1fr)); gap: 8mm; }
.item-list li { break-inside: avoid; padding: 1.6mm 0; border-bottom: 1px solid ${c.line}; }
.item-list li:last-child { border-bottom: 0; }
.item-list strong { font-weight: 500; }

.chips { display: flex; flex-wrap: wrap; gap: 1.5mm; }
.chip { display: inline-block; border: 1px solid ${c.line}; border-radius: 999px; padding: 0.4mm 2.4mm; font-size: ${s.small}; color: ${c.ink}; background: ${c.white}; }
.chip--tint { background: ${c.mist}; }
.chip-group + .chip-group { margin-top: 3mm; }
.chip-group__label { font-size: ${s.small}; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${c.muted}; margin-bottom: 1.5mm; }

.quote { break-inside: avoid; display: flex; gap: 4mm; align-items: flex-start; background: ${c.mist}; border-left: 3mm solid ${c.lime}; padding: 5mm 6mm; }
.quote p { font-size: 12pt; line-height: 1.45; }
.quote cite { display: block; margin-top: 2mm; font-style: normal; font-size: ${s.small}; color: ${c.muted}; }
.hobbies { font-size: ${s.body}; color: ${c.muted}; }

/* Projects */
.project { break-inside: avoid; padding: 4mm 0; border-bottom: 1px solid ${c.line}; }
.project:first-child { padding-top: 0; }
.project h3 { font-size: 12pt; font-weight: 400; }
.project__meta { margin-top: 1mm; display: flex; flex-wrap: wrap; gap: 0 4mm; font-size: ${s.small}; color: ${c.muted}; }
.project__meta strong { color: ${c.teal}; font-weight: 600; }
.project p { margin-top: 2mm; }
.project .chips { margin-top: 2.5mm; }
.project--highlight { padding-left: 4mm; border-left: 2px solid ${c.lime}; border-bottom: 0; margin-bottom: 4mm; }
.compact .project { padding: 3mm 0; }
.compact .project h3 { font-size: ${s.h3}; font-weight: 500; }

/* Skills */
.skills { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; }
.skill-group { break-inside: avoid; }
.skill-group h3 { font-size: ${s.h3}; font-weight: 500; display: flex; justify-content: space-between; gap: 3mm; }
.skill-group h3 span { font-weight: 400; font-size: ${s.small}; color: ${c.muted}; }
.skill-row { display: grid; grid-template-columns: 1fr 18mm 16mm; align-items: center; gap: 2mm; padding: 1mm 0; border-bottom: 1px solid ${c.line}; }
.skill-row:last-child { border-bottom: 0; }
.bar { height: 1.2mm; background: ${c.line}; border-radius: 1mm; overflow: hidden; }
.bar span { display: block; height: 100%; background: ${c.teal}; }
.years { font-size: ${s.small}; color: ${c.muted}; text-align: right; font-variant-numeric: tabular-nums; }
.skill-group .chips { margin-top: 2mm; }

.colophon { margin-top: 12mm; padding-top: 3mm; border-top: 1px solid ${c.line}; font-size: ${s.small}; color: ${c.muted}; display: flex; align-items: center; gap: 2mm; }

@media screen {
  html { background: ${c.mist}; }
  body { background: ${c.mist}; padding: 8mm 0; }
  .page { width: 210mm; margin: 0 auto 8mm; box-shadow: 0 0 0 1px ${c.line}, 0 1px 3px rgb(43 43 43 / 0.08); }
  .page--cover { min-height: 297mm; }
  .page--body { padding: ${p.marginTop} ${p.marginX} ${p.marginBottom}; min-height: 297mm; }
}
`

export const CV_STYLES = `${FONTS}\n${BASE}`
