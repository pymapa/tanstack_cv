import type { CvDocument } from '~/cv/schema'
import type { CvRenderOptions } from '../render-html'
import { Colophon } from '../sections/common'
import { CoverBand, Expertise, Hobbies, KeyRolesAndSkills, Profile, Strengths, Testimonial } from '../sections/cover'
import { EducationAndCertificates, Languages, WorkHistory } from '../sections/history'
import { ProjectHighlights, ProjectHistory } from '../sections/projects'
import { Skills } from '../sections/skills'

type Props = Readonly<{ cv: CvDocument; options: CvRenderOptions }>

export function SidebarLayout({ cv, options }: Props) {
  const highlights = cv.projects.filter((p) => p['x-highlight'] === true)
  const others = cv.projects.filter((p) => p['x-highlight'] !== true)

  return (
    <div className="page page--sidebar">
      <CoverBand cv={cv} options={options} />
      <div className="sidebar-grid">
        <aside className="sidebar" aria-label="At a glance">
          <Expertise cv={cv} />
          <Skills skills={cv.skills} />
          <EducationAndCertificates cv={cv} />
          <Languages languages={cv.languages ?? []} />
        </aside>
        <div className="sidebar-main">
          <Profile cv={cv} />
          <Strengths cv={cv} />
          <KeyRolesAndSkills cv={cv} />
          <Testimonial cv={cv} />
          <ProjectHighlights projects={highlights} />
          <ProjectHistory projects={others} afterHighlights={highlights.length > 0} />
          <WorkHistory work={cv.work ?? []} />
          <Hobbies cv={cv} />
          <Colophon name={cv.basics.name} />
        </div>
      </div>
    </div>
  )
}
