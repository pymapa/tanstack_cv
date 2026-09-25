import { describe, expect, it } from 'vitest'
import { VariantName } from '~/cv/variant'

describe('VariantName', () => {
  it.each(['PM', 'Client X', 'SM-PO-AI', 'a'.repeat(40)])('should accept "%s"', (name) => {
    expect(VariantName.safeParse(name).success).toBe(true)
  })

  it('should trim surrounding spaces', () => {
    expect(VariantName.parse('  Client X ')).toBe('Client X')
  })

  it.each(['', '   ', 'a'.repeat(41), 'Client/X', 'Kipinä', '<b>', 'P\tM'])('should reject %j', (name) => {
    expect(VariantName.safeParse(name).success).toBe(false)
  })
})
