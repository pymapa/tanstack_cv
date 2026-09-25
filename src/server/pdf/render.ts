import { PDFDocument } from 'pdf-lib'
import { chromium, type Browser, type BrowserContext } from 'playwright'

/**
 * HTML → tagged PDF with Chromium (spec §7.7, D3).
 * Each render gets a fresh context with JavaScript disabled and every network request aborted,
 * so CV content can't run scripts or reach anything (no SSRF). Concurrency and time are bounded.
 */

export type PdfMeta = Readonly<{
  title: string
  subject: string
  keywords: readonly string[]
  attachment?: Readonly<{ fileName: string; json: string }>
}>

export type PdfRendererOptions = Readonly<{
  launch: () => Promise<Browser>
  maxConcurrency: number
  timeoutMs: number
}>

export type PdfRenderer = Readonly<{
  render: (html: string, meta: PdfMeta) => Promise<Uint8Array>
  close: () => Promise<void>
}>

const printInContext = async (context: BrowserContext, html: string): Promise<Uint8Array> => {
  await context.route('**/*', (route) => route.abort())
  const page = await context.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  return page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true })
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

export const createPdfRenderer = ({ launch, maxConcurrency, timeoutMs }: PdfRendererOptions): PdfRenderer => {
  let browserPromise: Promise<Browser> | undefined
  let active = 0
  const waiting: (() => void)[] = []

  const startLaunch = (): Promise<Browser> => {
    const attempt = launch()
    browserPromise = attempt
    // A failed launch must not stick: the next render tries again.
    attempt.catch(() => {
      if (browserPromise === attempt) browserPromise = undefined
    })
    return attempt
  }

  const getBrowser = async (): Promise<Browser> => {
    const current = browserPromise ?? startLaunch()
    const browser = await current
    if (browser.isConnected()) return browser
    // Crashed or closed: relaunch once, shared by every render that notices at the same time.
    return browserPromise === current ? startLaunch() : getBrowser()
  }

  const acquire = async (): Promise<void> => {
    if (active < maxConcurrency) {
      active++
      return
    }
    await new Promise<void>((resolve) => waiting.push(resolve))
  }

  /** Hands the slot straight to the next waiter, or frees it. */
  const release = (): void => {
    const next = waiting.shift()
    if (next === undefined) active--
    else next()
  }

  /** Launch, open a context and print, all within `timeoutMs`. */
  const print = async (html: string): Promise<Uint8Array> => {
    const opened: { context?: BrowserContext } = {}
    const work = (async () => {
      const browser = await getBrowser()
      opened.context = await browser.newContext({ javaScriptEnabled: false, offline: true })
      return printInContext(opened.context, html)
    })()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('PDF render timed out'))
      }, timeoutMs)
    })
    try {
      return await Promise.race([work, timedOut])
    } finally {
      clearTimeout(timer)
      // After a timeout: close the context to stop the render, let it wind down (a launch is
      // bounded by Playwright's own timeout), and close a context opened in the meantime.
      // Only then is the slot released, so hung renders can't pile up past maxConcurrency.
      await opened.context?.close()
      await work.catch(() => undefined)
      await opened.context?.close()
    }
  }

  return {
    render: async (html, meta) => {
      await acquire()
      let printed: Uint8Array
      try {
        printed = await print(html)
      } finally {
        release()
      }
      // pdf-lib work needs no browser, so it runs after the slot is free.
      return addMetadata(printed, meta)
    },
    close: async () => {
      const pending = browserPromise
      browserPromise = undefined
      if (pending === undefined) return
      const browser = await pending.catch(() => undefined) // a failed launch has nothing to close
      await browser?.close()
    },
  }
}

const defaultRenderer = createPdfRenderer({
  launch: () => chromium.launch({ headless: true }),
  maxConcurrency: Number(process.env['PDF_MAX_CONCURRENCY'] ?? 2),
  timeoutMs: 15_000,
})

export const renderPdf = defaultRenderer.render
export const closePdfRenderer = defaultRenderer.close
