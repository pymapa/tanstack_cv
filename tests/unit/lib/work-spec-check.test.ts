import { describe, expect, it } from 'vitest'
import { checkAttachments, MAX_DOCUMENTS, MAX_PDF_BYTES } from '~/lib/ai/work-spec'

const doc = (value = btoa('%PDF-1.7'), mimeType = 'application/pdf') => ({
  type: 'document',
  source: { type: 'data', value, mimeType },
})
const user = (...parts: unknown[]) => ({ id: 'm1', role: 'user', parts })

describe('checkAttachments', () => {
  it('should accept text-only messages', () => {
    expect(checkAttachments([user({ type: 'text', content: 'hi' })])).toEqual({ ok: true, value: undefined })
  })

  it('should accept a PDF document part within the limits', () => {
    expect(checkAttachments([user(doc())]).ok).toBe(true)
  })

  it('should reject a document that is not a PDF', () => {
    expect(checkAttachments([user(doc(btoa('x'), 'text/html'))])).toEqual({
      ok: false,
      error: 'Only PDF documents are supported.',
    })
  })

  it('should reject a document given by URL', () => {
    const part = { type: 'document', source: { type: 'url', value: 'https://example.com/a.pdf' } }

    expect(checkAttachments([user(part)]).ok).toBe(false)
  })

  it('should reject a PDF larger than the limit', () => {
    const value = 'A'.repeat(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8)

    expect(checkAttachments([user(doc(value))])).toEqual({ ok: false, error: 'A document is too large.' })
  })

  it('should reject more documents than the limit across the conversation', () => {
    const messages = Array.from({ length: MAX_DOCUMENTS + 1 }, () => user(doc()))

    expect(checkAttachments(messages)).toEqual({ ok: false, error: 'Too many documents in this conversation.' })
  })

  it.each(['image', 'audio', 'video'])('should reject %s parts', (type) => {
    expect(checkAttachments([user({ type, source: { type: 'data', value: 'x', mimeType: 'x' } })]).ok).toBe(false)
  })

  it('should check parts in model-message content arrays too', () => {
    expect(checkAttachments([{ role: 'user', content: [doc(btoa('x'), 'text/html')] }]).ok).toBe(false)
  })

  it('should reject a body that is not a message list', () => {
    expect(checkAttachments({ messages: 'nope' }).ok).toBe(false)
  })
})
