import { PORTRAIT_PAGE, composeStyles } from './styles'
import { theme } from './theme'

const { color: c, size: s, page: p } = theme

const SIDEBAR = `
.page--sidebar .band { padding-bottom: 10mm; }
.page--sidebar .band__top { margin-bottom: 10mm; }
.sidebar-grid { display: grid; grid-template-columns: 62mm 1fr; align-items: start; }
.sidebar { padding: 10mm 7mm 10mm ${p.marginX}; border-right: 1px solid ${c.line}; }
.sidebar-main { padding: 10mm ${p.marginX} 10mm 8mm; }
.sidebar > * + *, .sidebar-main > * + * { margin-top: 9mm; }
.sidebar .section, .sidebar-main .section { margin-top: 0; }
.sidebar > * + .section, .sidebar-main > * + .section { margin-top: 9mm; }
.sidebar .section > h2 { font-size: ${s.label}; margin-bottom: 3mm; }
.sidebar .entry { display: block; }
.sidebar .entry__aside { padding: 0 0 1mm; }
.sidebar .entries > .entry + .entry { margin-top: 3.5mm; }
.sidebar .skill-list { gap: 0.5mm 3mm; }
.sidebar-main .entry { grid-template-columns: 26mm 1fr; gap: 4mm; }
.sidebar-main .project p { max-width: none; }
.sidebar-main .quote, .sidebar-main .hobbies { padding-left: 0; }
.sidebar-main .two-col { grid-template-columns: repeat(auto-fit, minmax(50mm, 1fr)); gap: 8mm; }
@media screen {
  .page--sidebar { min-height: var(--page-height); }
}
`

const EDITORIAL = `
.band { background: ${c.white}; color: ${c.ink}; padding: 18mm ${p.marginX} 4mm; }
.logo-chip { background: none; padding: 0; }
.band__eyebrow { color: ${c.muted}; }
.band h1 { font-family: 'CV Serif', 'Noto Serif', Georgia, serif; font-size: 54pt; letter-spacing: -0.03em; }
.band__tagline, .band__contact { color: ${c.muted}; }
.section > h2 { font-family: 'CV Serif', 'Noto Serif', Georgia, serif; }
.section { border-top-width: 1px; }
.quote::before { width: 20mm; height: 0.8mm; }
`

/* A title slide, then every top-level block on its own page. */
const SLIDES = `
@page { size: A4 landscape; margin: 14mm 0; }
@page :first { margin: 0; }
:root { --page-width: 297mm; --page-height: 210mm; }

.page--cover { display: block; }
.band { height: var(--page-height); display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 20mm 24mm; break-after: page; }
.band h1 { font-size: 60pt; }
.band__top { align-self: stretch; }
.band__tagline { max-width: 220mm; }
.cover-body { display: block; padding: 0 24mm; }
.cover-body > *, .page--body > .section { break-before: page; margin-top: 0; }
.cover-body > .hobbies { break-before: auto; margin-top: 8mm; }
.page--body { padding: 0 24mm; }
.section > h2 { font-size: 28pt; margin-bottom: 10mm; }
.lede { font-size: 13pt; max-width: 210mm; }
.quote { padding-left: 0; }
.quote p { font-size: 22pt; max-width: 220mm; }
`

const ONE_PAGE = `
@page :first { margin: 0 0 10mm; }
.page--cover { break-after: auto; }
.band { padding: 10mm ${p.marginX} 8mm; }
.band__top { margin-bottom: 8mm; }
.band h1 { font-size: 34pt; }
.band__tagline { margin-top: 4mm; font-size: 12pt; }
.cover-body { padding: 7mm ${p.marginX} 0; gap: 5mm; }
.lede { font-size: ${s.body}; }
.strengths { gap: 3mm 8mm; }
.strengths p { margin-top: 0.5mm; }
.item-list li { padding: 0.4mm 0; }
.section--minor > h2 { margin-bottom: 1.5mm; }
.page--body { padding: 6mm ${p.marginX} 0; }
.section > h2 { font-size: 16pt; margin-bottom: 3mm; }
.entries > .entry + .entry, .compact .entries > .entry + .entry { margin-top: 3.5mm; }
.colophon { margin-top: 6mm; }
@media screen {
  .page--cover { min-height: 0; margin-bottom: 0; box-shadow: none; }
  .page--body { min-height: 0; padding: 6mm ${p.marginX} 10mm; box-shadow: none; }
}
`

export const SIDEBAR_STYLES = composeStyles(PORTRAIT_PAGE, SIDEBAR)
export const EDITORIAL_STYLES = composeStyles(PORTRAIT_PAGE, EDITORIAL)
export const SLIDES_STYLES = composeStyles(SLIDES)
export const ONE_PAGE_STYLES = composeStyles(PORTRAIT_PAGE, ONE_PAGE)
