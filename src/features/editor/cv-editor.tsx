import { useCallback, useMemo, type JSX } from 'react'
import type { CvDocument } from '~/cv/schema'
import { EditorProvider } from './editor-context'
import { ProjectsSection } from './sections/projects-section'
import {
  BasicsSection,
  KeyRolesSection,
  KeySkillsSection,
  KeywordsSection,
  StrengthsSection,
} from './sections/profile-sections'
import { CertificatesSection, TestimonialsSection, WorkSection } from './sections/history-sections'
import { SkillsSection } from './sections/skills-section'
import { setIn, type Path } from './update'
import type { EditorIssue } from './validation'

export type CvEditorProps = Readonly<{
  value: CvDocument
  /** Always receives a new object; the input is never mutated. */
  onChange: (next: CvDocument) => void
  issues: readonly EditorIssue[]
  /** true for a new CV. Existing CVs keep the name read-only. */
  nameEditable?: boolean
}>

/** Structured CV form. Controlled: the parent owns the draft and validation. */
export function CvEditor({ value, onChange, issues, nameEditable = false }: CvEditorProps): JSX.Element {
  const set = useCallback(
    (path: Path, next: unknown) => {
      onChange(setIn(value, path, next))
    },
    [value, onChange],
  )
  const context = useMemo(() => ({ cv: value, set, issues, nameEditable }), [value, set, issues, nameEditable])

  return (
    <EditorProvider value={context}>
      <div className="flex flex-col" data-testid="cv-editor">
        <BasicsSection />
        <StrengthsSection />
        <KeyRolesSection />
        <KeySkillsSection />
        <KeywordsSection />
        <SkillsSection />
        <ProjectsSection />
        <WorkSection />
        <CertificatesSection />
        <TestimonialsSection />
      </div>
    </EditorProvider>
  )
}
