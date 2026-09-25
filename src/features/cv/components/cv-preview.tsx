import { useEffect, useMemo, useRef, useState } from 'react'
import type { CvDocument } from '~/cv/schema'
import { useDebounced } from '~/lib/use-debounced'
import { DEFAULT_RENDER_OPTIONS, renderCvHtml, type CvRenderOptions } from '~/pdf/template/render-html'

/** A4 width at 96 dpi. The template lays pages out at this width. */
const A4_WIDTH_PX = 794
const PREVIEW_DEBOUNCE_MS = 300

type Props = Readonly<{ cv: CvDocument; options?: CvRenderOptions }>

/**
 * Live preview of the PDF template. The HTML runs in a fully sandboxed iframe
 * (no scripts, opaque origin), so CV text can never execute anything (spec §7.7).
 */
export function CvPreview({ cv, options = DEFAULT_RENDER_OPTIONS }: Props) {
  const debounced = useDebounced(cv, PREVIEW_DEBOUNCE_MS)
  const html = useMemo(() => renderCvHtml(debounced, options), [debounced, options])
  const frameBox = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: A4_WIDTH_PX, height: 800 })

  useEffect(() => {
    const el = frameBox.current
    if (el === null) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  const scale = Math.min(1, box.width / A4_WIDTH_PX)

  return (
    <div ref={frameBox} className="relative h-full w-full overflow-hidden" data-testid="cv-preview">
      <iframe
        title="CV preview"
        sandbox=""
        srcDoc={html}
        className="absolute left-0 top-0 border-0 bg-mist"
        style={{
          width: A4_WIDTH_PX,
          height: box.height / scale,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  )
}
