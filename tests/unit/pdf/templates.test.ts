import { describe, expect, it } from 'vitest'
import { CV_TEMPLATE_IDS } from '~/cv/schema'
import { CV_TEMPLATES, DEFAULT_TEMPLATE, templateOf } from '~/pdf/template/templates'
import { buildCv } from '../../fixtures/cv'

describe('templateOf', () => {
  it('should return the portrait template when the CV has no template', () => {
    expect(templateOf(buildCv())).toBe('kipina-portrait')
    expect(DEFAULT_TEMPLATE).toBe('kipina-portrait')
  })

  it('should return the template stored in the CV', () => {
    expect(templateOf(buildCv({ meta: { 'x-template': 'kipina-landscape' } }))).toBe('kipina-landscape')
  })
})

describe('CV_TEMPLATES', () => {
  it('should describe every template id the schema allows', () => {
    expect(Object.keys(CV_TEMPLATES).toSorted()).toEqual([...CV_TEMPLATE_IDS].toSorted())
  })

  it('should give landscape pages a wider preview than portrait pages', () => {
    expect(CV_TEMPLATES['kipina-landscape'].pageWidthPx).toBeGreaterThan(CV_TEMPLATES['kipina-portrait'].pageWidthPx)
  })
})
