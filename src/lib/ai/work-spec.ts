import type { ContentPart } from '@tanstack/ai'
import { err, ok, type Result } from '~/lib/result'

export const MAX_PDF_BYTES = 4 * 1024 * 1024
export const MAX_TEXT_BYTES = 100 * 1024
export const WORK_SPEC_ACCEPT = '.pdf,.txt,.md,application/pdf,text/plain,text/markdown'

const PDF_MIME = 'application/pdf'
const PDF_HEADER = '%PDF-'
const TEXT_EXTENSION = /\.(?:txt|md)$/i

const isPdf = (file: File) => file.type === PDF_MIME || /\.pdf$/i.test(file.name)
const isText = (file: File) =>
  file.type === 'text/plain' || file.type === 'text/markdown' || TEXT_EXTENSION.test(file.name)

const safeName = (name: string) => name.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100)

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const tooLarge = (file: File, limit: string) => err(`${file.name} is too large. The limit is ${limit}.`)

export const toWorkSpecPart = async (file: File): Promise<Result<ContentPart, string>> => {
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) return tooLarge(file, '4 MB')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (new TextDecoder().decode(bytes.subarray(0, PDF_HEADER.length)) !== PDF_HEADER) {
      return err(`${file.name} is not a valid PDF.`)
    }
    return ok({
      type: 'document',
      source: { type: 'data', value: toBase64(bytes), mimeType: PDF_MIME },
      metadata: { filename: safeName(file.name) },
    })
  }
  if (isText(file)) {
    if (file.size > MAX_TEXT_BYTES) return tooLarge(file, '100 KB')
    const text = (await file.text()).replaceAll('</work_spec>', '')
    return ok({ type: 'text', content: `<work_spec filename="${safeName(file.name)}">\n${text}\n</work_spec>` })
  }
  return err(`${file.name} is not a PDF, .txt or .md file.`)
}

export const MAX_DOCUMENTS = 3
const MAX_PDF_BASE64_LENGTH = Math.ceil(MAX_PDF_BYTES / 3) * 4
const MEDIA_PART_TYPES = new Set(['image', 'audio', 'video'])

type Part = Readonly<{ type?: unknown; source?: { type?: unknown; value?: unknown; mimeType?: unknown } }>

const partsOf = (message: unknown): readonly Part[] => {
  if (message === null || typeof message !== 'object') return []
  const { parts, content } = message as { parts?: unknown; content?: unknown }
  return [parts, content].flatMap((list) => (Array.isArray(list) ? (list as Part[]) : []))
}

export const checkAttachments = (messages: unknown): Result<void, string> => {
  if (!Array.isArray(messages)) return err('Messages must be a list.')
  const parts = messages.flatMap(partsOf)
  if (parts.some((p) => typeof p.type === 'string' && MEDIA_PART_TYPES.has(p.type))) {
    return err('Only PDF documents are supported.')
  }
  const documents = parts.filter((p) => p.type === 'document')
  if (documents.length > MAX_DOCUMENTS) return err('Too many documents in this conversation.')
  for (const { source } of documents) {
    if (source?.type !== 'data' || source.mimeType !== PDF_MIME || typeof source.value !== 'string') {
      return err('Only PDF documents are supported.')
    }
    if (source.value.length > MAX_PDF_BASE64_LENGTH) return err('A document is too large.')
  }
  return ok(undefined)
}

const WORK_SPEC_OPENING = /^<work_spec filename="([^"]*)">/

/** The file name of an attached work spec part, or null when the part is not an attachment. */
export const attachmentName = (
  part: Readonly<{ type: string; metadata?: unknown; content?: unknown }>,
): string | null => {
  if (part.type === 'document') return (part.metadata as { filename?: string } | undefined)?.filename ?? 'Document'
  if (part.type === 'text' && typeof part.content === 'string') return WORK_SPEC_OPENING.exec(part.content)?.[1] ?? null
  return null
}

/** A text part that stands in for an attachment whose content is not kept. */
export const workSpecPlaceholder = (filename: string) => ({
  type: 'text' as const,
  content: `<work_spec filename="${safeName(filename)}">\n(The file is not kept in the saved chat.)\n</work_spec>`,
})
