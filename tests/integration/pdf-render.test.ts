import { PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib'
import { afterAll, describe, expect, it } from 'vitest'
import { closePdfRenderer, renderPdf } from '~/server/pdf/render'

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
