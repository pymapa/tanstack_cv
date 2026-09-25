import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import { CvDocument } from '~/cv/schema'

const SAMPLE_DIR = join(import.meta.dirname, '../../sample_data')
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const sampleFiles = readdirSync(join(SAMPLE_DIR, 'cvs')).filter((f) => f.endsWith('.json'))

const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addSchema(readJson(join(SAMPLE_DIR, 'schema/jsonresume.schema.json')) as object, 'jsonresume.schema.json')
const validateJsonSchema = ajv.compile(readJson(join(SAMPLE_DIR, 'schema/cv.schema.json')) as object)

describe('CvDocument schema', () => {
  it('should find all 36 sample CVs', () => {
    expect(sampleFiles).toHaveLength(36)
  })

  it.each(sampleFiles)('should accept sample %s with both Zod and the JSON Schema', (file) => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', file))

    const zod = CvDocument.safeParse(data)
    const jsonSchemaValid = validateJsonSchema(data)

    expect(zod.success, JSON.stringify(zod.error?.issues.slice(0, 3))).toBe(true)
    expect(jsonSchemaValid).toBe(true)
  })

  it('should keep every field of a sample CV when parsing', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p10-v2.json')) as Record<string, unknown>

    const parsed = CvDocument.parse(data)

    expect(parsed).toEqual(data)
  })

  it('should reject an unknown field instead of silently dropping it', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as Record<string, unknown>

    expect(CvDocument.safeParse({ ...data, volunteer: [] }).success).toBe(false)
  })

  it('should reject a CV when basics.name is missing', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { basics: Record<string, unknown> }
    const { name: _omit, ...basics } = data.basics

    expect(CvDocument.safeParse({ ...data, basics }).success).toBe(false)
  })

  it('should reject unknown keys inside Kipinä x- objects', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { basics: Record<string, unknown> }
    const basics = { ...data.basics, 'x-strengths': [{ title: 'Ok', extra: 'nope' }] }

    expect(CvDocument.safeParse({ ...data, basics }).success).toBe(false)
  })

  it('should reject an over-long summary when it exceeds 5000 characters', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { basics: Record<string, unknown> }
    const basics = { ...data.basics, summary: 'a'.repeat(5001) }

    expect(CvDocument.safeParse({ ...data, basics }).success).toBe(false)
  })

  it('should reject a malformed date when a project startDate is not ISO-like', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { projects: Record<string, unknown>[] }
    const projects = [{ ...data.projects[0], startDate: 'spring 2020' }]

    expect(CvDocument.safeParse({ ...data, projects }).success).toBe(false)
  })

  it('should accept a known template in meta.x-template with both Zod and the JSON Schema', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { meta: Record<string, unknown> }
    const withTemplate = { ...data, meta: { ...data.meta, 'x-template': 'kipina-landscape' } }

    expect(CvDocument.safeParse(withTemplate).success).toBe(true)
    expect(validateJsonSchema(withTemplate)).toBe(true)
  })

  it('should reject an unknown template in meta.x-template with both Zod and the JSON Schema', () => {
    const data = readJson(join(SAMPLE_DIR, 'cvs', 'p01-v1.json')) as { meta: Record<string, unknown> }
    const withTemplate = { ...data, meta: { ...data.meta, 'x-template': 'comic-sans' } }

    expect(CvDocument.safeParse(withTemplate).success).toBe(false)
    expect(validateJsonSchema(withTemplate)).toBe(false)
  })
})
