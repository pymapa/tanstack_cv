import { PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib'
import { chromium, type Browser } from 'playwright'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { closePdfRenderer, createPdfRenderer, renderPdf } from '~/server/pdf/render'

const HTML = `<!doctype html><html lang="en"><head><title>Anna Example – CV</title></head>
<body><h1>Anna Example</h1><h2>Project highlights</h2><p>Payments platform renewal</p></body></html>`

const meta = {
  title: 'Anna Example – Software Architect – Kipinä CV',
  subject: 'CV',
  keywords: ['Scrum', 'Azure'],
  attachment: { fileName: 'cv.json', json: '{"basics":{"name":"Anna Example"}}' },
}

afterAll(async () => {
  await closePdfRenderer()
})

describe('renderPdf', () => {
  it('should produce a tagged PDF with document metadata', async () => {
    const bytes = await renderPdf(HTML, meta)
    const pdf = await PDFDocument.load(bytes)

    expect(pdf.getTitle()).toBe(meta.title)
    expect(pdf.getAuthor()).toBe('Kipinä')
    expect(pdf.catalog.has(PDFName.of('StructTreeRoot'))).toBe(true)
    expect(pdf.catalog.get(PDFName.of('Lang'))?.toString()).toContain('en')
  }, 30_000)

  it('should embed the CV JSON as a file attachment', async () => {
    const bytes = await renderPdf(HTML, meta)
    const pdf = await PDFDocument.load(bytes)

    const names = pdf.catalog.lookup(PDFName.of('Names'), PDFDict)
    const files = names.lookup(PDFName.of('EmbeddedFiles'), PDFDict)

    // pdf-lib stores file names as UTF-16 hex strings.
    expect(files.toString()).toContain(PDFHexString.fromText('cv.json').toString())
  }, 30_000)

  it('should not load external resources when the HTML references them', async () => {
    const hostile = HTML.replace(
      '</body>',
      '<img src="http://127.0.0.1:9/leak.png"><script>document.title="ran"</script></body>',
    )

    const bytes = await renderPdf(hostile, meta)

    // Rendering succeeds offline; the script never runs (JS disabled), so the title stays ours.
    expect((await PDFDocument.load(bytes)).getTitle()).toBe(meta.title)
  }, 30_000)
})

describe('createPdfRenderer', () => {
  it('should retry the browser launch when an earlier launch failed', async () => {
    const launch = vi
      .fn<() => Promise<Browser>>()
      .mockRejectedValueOnce(new Error('launch failed'))
      .mockImplementation(() => chromium.launch())
    const renderer = createPdfRenderer({ launch, maxConcurrency: 1, timeoutMs: 15_000 })

    await expect(renderer.render(HTML, meta)).rejects.toThrow('launch failed')
    const bytes = await renderer.render(HTML, meta)

    expect((await PDFDocument.load(bytes)).getTitle()).toBe(meta.title)
    await renderer.close()
  }, 30_000)

  it('should launch one browser when several renders start at once', async () => {
    const launch = vi.fn(() => chromium.launch())
    const renderer = createPdfRenderer({ launch, maxConcurrency: 2, timeoutMs: 15_000 })

    await Promise.all([renderer.render(HTML, meta), renderer.render(HTML, meta)])

    expect(launch).toHaveBeenCalledTimes(1)
    await renderer.close()
  }, 30_000)

  it('should close the page and free its slot when a render times out', async () => {
    let browser: Browser | undefined
    const launch = async () => (browser = await chromium.launch())
    const renderer = createPdfRenderer({ launch, maxConcurrency: 1, timeoutMs: 1 })

    await expect(renderer.render(HTML, meta)).rejects.toThrow('timed out')
    // With one slot, this would hang forever if the timed-out render still held it.
    await expect(renderer.render(HTML, meta)).rejects.toThrow('timed out')

    expect(browser?.contexts()).toHaveLength(0)
    await renderer.close()
  }, 30_000)
})
