import { join } from 'node:path'
import { uuidv7 } from '~/lib/id'
import { loadSampleData } from '../import/sample-data'
import type { CvRepository } from './cv-repository'
import { createMemoryCvRepository } from './memory-cv-repository'

/**
 * Process-wide repository. TEMPORARY: an in-memory store seeded from sample_data/ on first use.
 * Edits last until the dev server restarts. Replaced by the Postgres adapter in spec M1.
 * Kept on globalThis so Vite HMR doesn't re-seed (and change every id) on each edit.
 */
const globalStore = globalThis as typeof globalThis & { __cvRepository?: Promise<CvRepository> }

const create = async (): Promise<CvRepository> => {
  const loaded = await loadSampleData(join(process.cwd(), 'sample_data'))
  if (!loaded.ok) throw new Error(`Sample data import failed: ${loaded.error}`)
  return createMemoryCvRepository(loaded.value, { clock: () => new Date(), idGen: () => uuidv7() })
}

export const getCvRepository = (): Promise<CvRepository> => {
  globalStore.__cvRepository ??= create()
  return globalStore.__cvRepository
}
