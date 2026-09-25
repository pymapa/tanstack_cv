import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadSampleData } from '~/server/import/sample-data'

const SAMPLE_DIR = join(import.meta.dirname, '../../sample_data')

describe('loadSampleData', () => {
  it('should load 28 people and 36 CV versions when reading the sample folder', async () => {
    const result = await loadSampleData(SAMPLE_DIR)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(28)
    expect(result.value.flatMap((p) => p.versions)).toHaveLength(36)
  })

  it('should mark the primary version from index.json', async () => {
    const result = await loadSampleData(SAMPLE_DIR)
    if (!result.ok) throw new Error('load failed')

    const p03 = result.value.find((p) => p.legacyId === 'p03')

    expect(p03?.versions.find((v) => v.isPrimary)?.document.meta.variant).toBe('default')
    expect(p03?.versions.filter((v) => v.isPrimary)).toHaveLength(1)
  })

  it('should fail with a readable report when the folder does not exist', async () => {
    const result = await loadSampleData(join(SAMPLE_DIR, 'nope'))

    expect(result.ok).toBe(false)
  })
})
