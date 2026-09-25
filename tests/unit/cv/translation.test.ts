import { describe, expect, it } from 'vitest'
import {
  applyTranslatedText,
  detectCvLanguage,
  extractTranslatableText,
  otherLanguage,
  translatedVariantName,
} from '~/cv/translation'
import { buildCv, buildProject } from '../../fixtures/cv'

const finnishCv = buildCv({
  basics: {
    label: 'Ohjelmistoarkkitehti',
    summary:
      'Anna on kokenut ohjelmistoarkkitehti, joka suunnittelee käytännöllisiä järjestelmiä ja auttaa tiimejä onnistumaan.',
  },
  projects: [
    buildProject({
      description:
        'Vastasin maksujärjestelmän uudistuksen arkkitehtuurista ja tein tiiviisti yhteistyötä asiakkaan kanssa.',
    }),
  ],
})

describe('detectCvLanguage', () => {
  it('should detect English when the CV text is English', () => {
    expect(detectCvLanguage(buildCv())).toBe('en')
  })

  it('should detect Finnish when the CV text is Finnish', () => {
    expect(detectCvLanguage(finnishCv)).toBe('fi')
  })

  it('should not count Finnish letters in the person name as Finnish text', () => {
    const cv = buildCv({ basics: { name: 'Äijä Mäkelä-Öhman' } })

    expect(detectCvLanguage(cv)).toBe('en')
  })

  it('should read an English CV with Finnish place and client names as English', () => {
    const cv = buildCv({
      basics: { label: 'Developer', summary: 'Worked on Jyväskylä Energia systems. Studied at Jyväskylä.' },
      education: [{ institution: 'University of Jyväskylä', area: 'Computer Science' }],
      projects: [buildProject({ name: 'Kämppä booking', description: 'Worked on Pääkaupunkiseudun Kierrätyskeskus.' })],
    })

    expect(detectCvLanguage(cv)).toBe('en')
  })
})

describe('otherLanguage', () => {
  it('should swap English and Finnish', () => {
    expect(otherLanguage('en')).toBe('fi')
    expect(otherLanguage('fi')).toBe('en')
  })
})

describe('extractTranslatableText', () => {
  it('should return the text fields keyed by JSON pointer', () => {
    const cv = buildCv({
      basics: { 'x-strengths': [{ title: 'Calm under pressure', description: 'Keeps teams focused.' }] },
      projects: [buildProject({ description: 'Led the renewal.', roles: ['Architect'] })],
    })

    const segments = extractTranslatableText(cv)

    expect(segments).toEqual(
      expect.arrayContaining([
        { id: '/basics/label', text: 'Software Architect' },
        { id: '/basics/summary', text: 'Anna designs pragmatic systems and helps teams ship.' },
        { id: '/basics/x-strengths/0/title', text: 'Calm under pressure' },
        { id: '/basics/x-strengths/0/description', text: 'Keeps teams focused.' },
        { id: '/projects/0/name', text: 'Payments platform renewal' },
        { id: '/projects/0/description', text: 'Led the renewal.' },
        { id: '/projects/0/roles/0', text: 'Architect' },
      ]),
    )
  })

  it('should never include names, contact details, client names, dates or meta', () => {
    const cv = buildCv({
      basics: { email: 'anna@example.test', phone: '+358 40 000 0000', url: 'https://example.test' },
      projects: [buildProject({ startDate: '2024-01' })],
      work: [{ name: 'Example Oy', position: 'Developer' }],
      certificates: [{ name: 'Certified Example', issuer: 'Example Institute' }],
      'x-testimonials': [{ quote: 'Great work.', author: 'Bea Example' }],
      meta: { 'x-conversionNotes': ['Imported by hand'] },
    })

    const ids = extractTranslatableText(cv).map((s) => s.id)
    const texts = extractTranslatableText(cv).map((s) => s.text)

    expect(ids).not.toEqual(expect.arrayContaining([expect.stringMatching(/^\/meta|\/basics\/(name|email|phone|url)/)]))
    expect(texts).not.toEqual(
      expect.arrayContaining([
        'Anna Example',
        'Example Bank',
        'Example Oy',
        'Bea Example',
        'Imported by hand',
        '2024-01',
      ]),
    )
    expect(ids).toContain('/work/0/position')
    expect(ids).toContain('/x-testimonials/0/quote')
  })

  it('should skip empty text', () => {
    const cv = buildCv({ basics: { 'x-tagline': '  ' } })

    expect(extractTranslatableText(cv).map((s) => s.id)).not.toContain('/basics/x-tagline')
  })
})

describe('applyTranslatedText', () => {
  it('should replace the translated fields and keep everything else', () => {
    const cv = buildCv({ projects: [buildProject({ roles: ['Architect'], startDate: '2024' })] })

    const result = applyTranslatedText(cv, [
      { id: '/basics/label', text: 'Ohjelmistoarkkitehti' },
      { id: '/projects/0/roles/0', text: 'Arkkitehti' },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.basics.label).toBe('Ohjelmistoarkkitehti')
    expect(result.value.projects[0]?.roles).toEqual(['Arkkitehti'])
    expect(result.value.projects[0]?.entity).toBe('Example Bank')
    expect(result.value.projects[0]?.startDate).toBe('2024')
    expect(result.value.basics.name).toBe('Anna Example')
  })

  it('should not change the input CV', () => {
    const cv = buildCv()

    applyTranslatedText(cv, [{ id: '/basics/label', text: 'Arkkitehti' }])

    expect(cv.basics.label).toBe('Software Architect')
  })

  it('should keep the original text of fields the translation left out', () => {
    const result = applyTranslatedText(buildCv(), [{ id: '/basics/label', text: 'Arkkitehti' }])

    expect(result.ok && result.value.basics.summary).toBe('Anna designs pragmatic systems and helps teams ship.')
  })

  it.each(['/basics/name', '/meta/personId', '/projects/0/entity', '/__proto__/polluted', '/basics/x-unknown'])(
    'should reject a translation for %s, which is not a translatable field',
    (id) => {
      const cv = buildCv({ projects: [buildProject()] })

      const result = applyTranslatedText(cv, [{ id, text: 'x' }])

      expect(result).toEqual({ ok: false, error: 'UNKNOWN_FIELD' })
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    },
  )
})

describe('translatedVariantName', () => {
  it('should add the language to the variant name', () => {
    expect(translatedVariantName('PM', 'fi')).toBe('PM-fi')
  })

  it('should replace an existing language suffix', () => {
    expect(translatedVariantName('PM-en', 'fi')).toBe('PM-fi')
    expect(translatedVariantName('default-FI', 'en')).toBe('default-en')
  })

  it('should keep the name within the 60-character limit for version names', () => {
    expect(translatedVariantName('x'.repeat(70), 'fi')).toBe(`${'x'.repeat(57)}-fi`)
  })
})
