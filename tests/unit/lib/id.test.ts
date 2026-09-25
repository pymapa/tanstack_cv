import { describe, expect, it } from 'vitest'
import { uuidv7 } from '~/lib/id'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('should produce an RFC 9562 version 7 UUID', () => {
    expect(uuidv7()).toMatch(UUID_V7)
  })

  it('should sort by creation time when clock values increase', () => {
    const a = uuidv7(1_700_000_000_000)
    const b = uuidv7(1_700_000_000_001)

    expect(a < b).toBe(true)
  })

  it('should be unique when generated many times in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1_700_000_000_000)))

    expect(ids.size).toBe(1000)
  })
})
