import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CvDocument } from '~/cv/schema'
import { renderCvHtml } from '~/pdf/template/render-html'
import { buildCv, buildProject } from '../../fixtures/cv'

const sample = CvDocument.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, '../../../sample_data/cvs/p10-v2.json'), 'utf8')),
)

/** Visible markup only: drops the <style> block (fonts/logo data URIs live there or in src attributes). */
const bodyOf = (html: string): string => html.replace(/<style>[\s\S]*?<\/style>/g, '')

describe('renderCvHtml', () => {
  it('should produce a full English HTML document', () => {
    const html = renderCvHtml(buildCv())

    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="en">')
  })

  it('should have exactly one h1 containing the name', () => {
    const html = renderCvHtml(buildCv({ basics: { name: 'Anna Example' } }))

    const h1s = html.match(/<h1[\s>][\s\S]*?<\/h1>/g) ?? []
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toContain('Anna Example')
  })

  it('should list highlighted projects before other projects', () => {
    const cv = buildCv({
      projects: [
        buildProject({ name: 'Ordinary project' }),
        buildProject({ name: 'Star project', 'x-highlight': true }),
      ],
    })

    const html = renderCvHtml(cv)

    expect(html.indexOf('Star project')).toBeGreaterThan(-1)
    expect(html.indexOf('Star project')).toBeLessThan(html.indexOf('Ordinary project'))
  })

  it('should hide contact details by default and show them when includeContact is true', () => {
    const cv = buildCv({ basics: { email: 'anna@example.com', phone: '+358 40 000 0000' } })

    expect(renderCvHtml(cv)).not.toContain('anna@example.com')
    expect(renderCvHtml(cv)).not.toContain('+358 40 000 0000')
    expect(renderCvHtml(cv, { includeContact: true })).toContain('anna@example.com')
  })

  it('should escape HTML when CV fields contain markup', () => {
    const html = renderCvHtml(buildCv({ basics: { name: '<img src=x onerror=alert(1)>' } }))

    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('should not contain scripts', () => {
    expect(renderCvHtml(sample, { includeContact: true })).not.toMatch(/<script/i)
  })

  it('should not reference any external URL when contact details are hidden', () => {
    const html = renderCvHtml(sample)

    expect(html).not.toMatch(/https?:\/\//)
  })

  it('should never reference external resources even with contact details', () => {
    const body = bodyOf(renderCvHtml(sample, { includeContact: true }))

    expect(body).not.toMatch(/(src|href)="https?:/)
    expect(body).not.toMatch(/<link/i)
  })

  it('should embed fonts and the logo as data URIs', () => {
    const html = renderCvHtml(buildCv())

    expect(html).toMatch(/@font-face[\s\S]*url\(data:font\/woff2;base64,/)
    expect(html).toMatch(
      /<img[^>]+src="data:image\/png;base64,[^"]+"[^>]*alt="Kipinä"|<img[^>]+alt="Kipinä"[^>]*src="data:image\/png;base64,/,
    )
  })

  it('should never render conversion notes or x-note fields', () => {
    const cv = buildCv({
      meta: { 'x-conversionNotes': ['SECRET-CONVERSION-NOTE'] },
      projects: [buildProject({ 'x-note': 'SECRET-PROJECT-NOTE' })],
    })

    const html = renderCvHtml(cv)

    expect(html).not.toContain('SECRET-CONVERSION-NOTE')
    expect(html).not.toContain('SECRET-PROJECT-NOTE')
  })

  it('should omit sections that have no content', () => {
    const html = bodyOf(renderCvHtml(buildCv()))

    expect(html).not.toMatch(/>Certificates</)
    expect(html).not.toMatch(/>Project highlights</)
    expect(html).not.toMatch(/>Languages</)
  })

  it('should render certificates when present', () => {
    const html = renderCvHtml(buildCv({ certificates: [{ name: 'Certified Tester', issuer: 'ISTQB' }] }))

    expect(html).toContain('Certified Tester')
  })

  it('should render the real sample with name, highlights and skills in reading order', () => {
    const html = bodyOf(renderCvHtml(sample))
    const name = html.indexOf(sample.basics.name)
    const firstHighlight = sample.projects.find((p) => p['x-highlight'] === true)
    const firstSkill = sample.skills[0]

    expect(name).toBeGreaterThan(-1)
    expect(firstHighlight).toBeDefined()
    expect(html.indexOf(firstHighlight?.name ?? '')).toBeGreaterThan(name)
    expect(html.indexOf(firstSkill?.name ?? '')).toBeGreaterThan(html.indexOf(firstHighlight?.name ?? ''))
  })
})
