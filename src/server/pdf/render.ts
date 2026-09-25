import { PDFDocument } from 'pdf-lib'
import { chromium, type Browser } from 'playwright'

/**
 * HTML → tagged PDF with Chromium (spec §7.7, D3).
 * Each render gets a fresh context with JavaScript disabled and every network request aborted,
 * so CV content can't run scripts or reach anything (no SSRF). Concurrency and time are bounded.
 */

const MAX_CONCURRENCY = Number(process.env['PDF_MAX_CONCURRENCY'] ?? 2)
const RENDER_TIMEOUT_MS = 15_000

export type PdfMeta = Readonly<{
  title: string
  subject: string
  keywords: readonly string[]
  attachment?: Readonly<{ fileName: string; json: string }>
}>

let browserPromise: Promise<Browser> | undefined
let active = 0
const waiting: (() => void)[] = []

const getBrowser = async (): Promise<Browser> => {
  if (browserPromise !== undefined) {
    const browser = await browserPromise
    if (browser.isConnected()) return browser
  }
  browserPromise = chromium.launch({ headless: true })
  return browserPromise
}

const acquire = async (): Promise<void> => {
  if (active < MAX_CONCURRENCY) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  active++
}

const release = (): void => {
  active--
  waiting.shift()?.()
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error('PDF render timed out'))
      }, ms),
    ),
  ])

const printToPdf = async (html: string): Promise<Uint8Array> => {
  const browser = await getBrowser()
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true })
  try {
    await context.route('**/*', (route) => route.abort())
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true })
  } finally {
    await context.close()
  }
}

const addMetadata = async (pdfBytes: Uint8Array, meta: PdfMeta): Promise<Uint8Array> => {
  const pdf = await PDFDocument.load(pdfBytes)
  const now = new Date()
  pdf.setTitle(meta.title, { showInWindowTitleBar: true })
  pdf.setAuthor('Kipinä')
  pdf.setSubject(meta.subject)
  pdf.setKeywords([...meta.keywords])
  pdf.setCreator('Kipinä CV bank')
  pdf.setProducer('Kipinä CV bank')
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)
  if (meta.attachment !== undefined) {
    await pdf.attach(new TextEncoder().encode(meta.attachment.json), meta.attachment.fileName, {
      mimeType: 'application/json',
      description: 'Machine-readable CV (JSON Resume 1.0 with Kipinä extensions)',
      creationDate: now,
      modificationDate: now,
    })
  }
  return pdf.save()
}

export const renderPdf = async (html: string, meta: PdfMeta): Promise<Uint8Array> => {
  await acquire()
  try {
    const printed = await withTimeout(printToPdf(html), RENDER_TIMEOUT_MS)
    return await addMetadata(printed, meta)
  } finally {
    release()
  }
}

export const closePdfRenderer = async (): Promise<void> => {
  const pending = browserPromise
  browserPromise = undefined
  if (pending !== undefined) await (await pending).close()
}
