import { describe, expect, it } from 'vitest'
import { searchParamsSchema } from '~/features/search/search-params'

const ID = '0198f3b2-7c1e-7a00-8000-000000000001'

describe('searchParamsSchema', () => {
  it('should keep cv ids when they look like ids', () => {
    expect(searchParamsSchema.parse({ cv: [ID] }).cv).toEqual([ID])
  })

  it('should drop the cv filter when a value is not an id', () => {
    expect(searchParamsSchema.parse({ cv: [ID, 'https://evil.example'] }).cv).toEqual([])
  })

  it('should default cv to an empty list when it is missing', () => {
    expect(searchParamsSchema.parse({}).cv).toEqual([])
  })
})
