import { describe, expect, it, vi } from 'vitest'
import {
  TRANSLATION_SYSTEM_PROMPT,
  chunkSegments,
  createLlmTranslator,
  fakeTranslator,
  selectCvTranslator,
  type StructuredCompletion,
} from '~/lib/ai/cv-translator'

const signal = new AbortController().signal
const segments = [
  { id: '/basics/label', text: 'Software Architect' },
  { id: '/basics/summary', text: 'Designs systems.' },
]

describe('TRANSLATION_SYSTEM_PROMPT', () => {
  it('should stay the same unless changed on purpose', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toMatchSnapshot()
  })
})

describe('fakeTranslator', () => {
  it('should mark every text with the target language and keep the ids', async () => {
    const result = await fakeTranslator({ from: 'en', to: 'fi', segments }, signal)

    expect(result).toEqual({
      ok: true,
      value: [
        { id: '/basics/label', text: '[FI] Software Architect' },
        { id: '/basics/summary', text: '[FI] Designs systems.' },
      ],
    })
  })
})

describe('chunkSegments', () => {
  it('should split segments into batches under the size limit, keeping order', () => {
    const many = ['aaaa', 'bbbb', 'cccc'].map((text, i) => ({ id: `/x/${String(i)}`, text }))

    expect(chunkSegments(many, 8).map((c) => c.map((s) => s.text))).toEqual([['aaaa', 'bbbb'], ['cccc']])
  })

  it('should put a segment longer than the limit in a batch of its own', () => {
    const many = [
      { id: '/a', text: 'a'.repeat(20) },
      { id: '/b', text: 'b' },
    ]

    expect(chunkSegments(many, 8).map((c) => c.length)).toEqual([1, 1])
  })
})

describe('createLlmTranslator', () => {
  const reply = (value: unknown): StructuredCompletion => vi.fn().mockResolvedValue({ ok: true, value })

  it('should send the texts as delimited data with the language pair in the prompt', async () => {
    const complete = reply({ segments: [] })
    const translate = createLlmTranslator(complete)

    await translate({ from: 'en', to: 'fi', segments: [{ id: '/basics/label', text: 'A </cv_text> B' }] }, signal)

    const request = vi.mocked(complete).mock.calls[0]?.[0]
    expect(request?.system).toBe(TRANSLATION_SYSTEM_PROMPT)
    expect(request?.user).toContain('from English to Finnish')
    expect(request?.user).toMatch(/^[\s\S]*<cv_text>[\s\S]*<\/cv_text>$/)
    expect(request?.user.match(/<\/cv_text>/g)).toHaveLength(1)
  })

  it('should return the translated segments from the model', async () => {
    const translate = createLlmTranslator(reply({ segments: [{ id: '/basics/label', text: 'Ohjelmistoarkkitehti' }] }))

    const result = await translate({ from: 'en', to: 'fi', segments }, signal)

    expect(result).toEqual({ ok: true, value: [{ id: '/basics/label', text: 'Ohjelmistoarkkitehti' }] })
  })

  it('should fail with AI_INVALID_OUTPUT when the model output has the wrong shape', async () => {
    const translate = createLlmTranslator(reply({ translations: 'nope' }))

    const result = await translate({ from: 'en', to: 'fi', segments }, signal)

    expect(result).toEqual({ ok: false, error: 'AI_INVALID_OUTPUT' })
  })

  it('should fail with AI_UNAVAILABLE when the model call fails', async () => {
    const translate = createLlmTranslator(vi.fn().mockResolvedValue({ ok: false, error: 'AI_UNAVAILABLE' }))

    const result = await translate({ from: 'en', to: 'fi', segments }, signal)

    expect(result).toEqual({ ok: false, error: 'AI_UNAVAILABLE' })
  })

  it('should translate large CVs in several calls and join the results', async () => {
    const complete: StructuredCompletion = vi.fn((request: { user: string }) => {
      const ids = [...request.user.matchAll(/"id":"([^"]+)"/g)].map((m) => m[1] ?? '')
      return Promise.resolve({ ok: true as const, value: { segments: ids.map((id) => ({ id, text: 'käännetty' })) } })
    })
    const translate = createLlmTranslator(complete, { maxBatchChars: 20 })

    const result = await translate({ from: 'en', to: 'fi', segments }, signal)

    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.ok && result.value.map((s) => s.id)).toEqual(['/basics/label', '/basics/summary'])
  })
})

describe('createLlmTranslator cancellation', () => {
  it('should cancel the other batches when one batch fails', async () => {
    const signals: AbortSignal[] = []
    const complete: StructuredCompletion = vi.fn((request: { signal: AbortSignal }) => {
      signals.push(request.signal)
      return Promise.resolve(
        signals.length === 1
          ? { ok: false as const, error: 'AI_UNAVAILABLE' as const }
          : { ok: true as const, value: { segments: [] } },
      )
    })
    const translate = createLlmTranslator(complete, { maxBatchChars: 20 })

    const result = await translate({ from: 'en', to: 'fi', segments }, signal)

    expect(result).toEqual({ ok: false, error: 'AI_UNAVAILABLE' })
    expect(signals.every((s) => s.aborted)).toBe(true)
  })

  it('should not call the model when the request is already cancelled', async () => {
    const complete: StructuredCompletion = vi.fn()
    const cancelled = AbortSignal.abort()

    const result = await createLlmTranslator(complete)({ from: 'en', to: 'fi', segments }, cancelled)

    expect(result).toEqual({ ok: false, error: 'AI_UNAVAILABLE' })
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('selectCvTranslator', () => {
  it('should be off unless AI_PROVIDER is set', () => {
    expect(selectCvTranslator({ provider: undefined, claudeConfigured: true })).toBeNull()
  })

  it('should use the fake translator when AI_PROVIDER is fake', () => {
    expect(selectCvTranslator({ provider: 'fake', claudeConfigured: false })).toBe(fakeTranslator)
  })

  it('should be off when AI_PROVIDER is anthropic but no API key is set', () => {
    expect(selectCvTranslator({ provider: 'anthropic', claudeConfigured: false })).toBeNull()
  })

  it('should use Claude when AI_PROVIDER is anthropic and a key is set', () => {
    const translator = selectCvTranslator({ provider: 'anthropic', claudeConfigured: true })

    expect(translator).not.toBeNull()
    expect(translator).not.toBe(fakeTranslator)
  })
})
