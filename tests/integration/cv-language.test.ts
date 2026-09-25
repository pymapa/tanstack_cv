import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCvLanguage, extractTranslatableText } from '~/cv/translation'
import { loadSampleData } from '~/server/import/sample-data'

const SAMPLE_DIR = join(import.meta.dirname, '../../sample_data')

describe('CV translation on the sample data', () => {
  it('should detect every sample CV as English, since they are all written in English', async () => {
    const result = await loadSampleData(SAMPLE_DIR)
    if (!result.ok) throw new Error('load failed')

    const languages = result.value.flatMap((p) => p.versions.map((v) => detectCvLanguage(v.document)))

    expect(new Set(languages)).toEqual(new Set(['en']))
  })

  it('should never send contact details of a sample CV to the translator', async () => {
    const result = await loadSampleData(SAMPLE_DIR)
    if (!result.ok) throw new Error('load failed')

    const sent = result.value
      .flatMap((p) => p.versions.map((v) => JSON.stringify(extractTranslatableText(v.document))))
      .join('\n')

    expect(sent).not.toMatch(/@example\.|\+358/)
  })
})
