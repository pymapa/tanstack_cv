import type { CvDocument } from '~/cv/schema'
import type { CvRenderOptions } from './render-html'
import { GridMark } from './sections/common'
import { Cover } from './sections/cover'
import { EducationAndCertificates, Languages, WorkHistory } from './sections/history'
import { ProjectHighlights, ProjectHistory } from './sections/projects'
import { Skills } from './sections/skills'
import { CV_TEMPLATES, DEFAULT_TEMPLATE } from './templates'

type Props = Readonly<{ cv: CvDocument; options: CvRenderOptions }>

/**
 * The Kipinä CV. Pure: props in, markup out. Shared by the live preview and the PDF renderer.
 * Section order follows spec §7.7. DOM order is the reading order.
 * Never renders meta.x-conversionNotes or x-note fields.
 */
export function CvDocumentView({ cv, options }: Props) {
  const highlights = cv.projects.filter((p) => p['x-highlight'] === true)
  const others = cv.projects.filter((p) => p['x-highlight'] !== true)
  const hasBody =
    cv.projects.length > 0 ||
    cv.skills.length > 0 ||
    (cv.work ?? []).length > 0 ||
    (cv.education ?? []).length > 0 ||
    (cv.certificates ?? []).length > 0 ||
    (cv.languages ?? []).length > 0

  return (
    <>
      <Cover cv={cv} options={options} />
      {hasBody && (
        <div className="page page--body">
          <ProjectHighlights projects={highlights} />
          <Skills skills={cv.skills} />
          <ProjectHistory projects={others} afterHighlights={highlights.length > 0} />
          <WorkHistory work={cv.work ?? []} />
          <EducationAndCertificates cv={cv} />
          <Languages languages={cv.languages ?? []} />
          <p className="colophon">
            <GridMark />
            <span>Kipinä · {cv.basics.name} · CV</span>
          </p>
        </div>
      )}
    </>
  )
}

/** The full standalone HTML document (no scripts, no external resources). */
export function CvHtmlDocument({ cv, options }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{`${cv.basics.name} – ${cv.basics.label} – Kipinä CV`}</title>
        <style>{CV_TEMPLATES[options.template ?? DEFAULT_TEMPLATE].styles}</style>
      </head>
      <body>
        <CvDocumentView cv={cv} options={options} />
      </body>
    </html>
  )
}
