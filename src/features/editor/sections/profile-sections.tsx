import type { TitledItem } from '~/cv/schema'
import { useEditor } from '../editor-context'
import { ChipsField, TextArea, TextField } from '../fields'
import { ListSection } from '../list-section'
import { Section, SectionIntro } from '../section'

export function BasicsSection() {
  const { nameEditable } = useEditor()
  return (
    <Section
      title="Basics & summary"
      paths={[
        'basics.name',
        'basics.label',
        'basics.summary',
        'basics.email',
        'basics.phone',
        'basics.x-experienceSummary',
        'basics.x-tagline',
      ]}
      defaultOpen
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          path={['basics', 'name']}
          label="Name"
          {...(nameEditable ? {} : { hint: 'Names are changed by an admin.' })}
          readOnly={!nameEditable}
          className="col-span-2"
        />
        <TextField path={['basics', 'label']} label="Title" className="col-span-2" />
        <TextField
          path={['basics', 'x-experienceSummary']}
          label="Experience"
          placeholder="20+ years of business experience"
        />
        <TextField path={['basics', 'x-tagline']} label="Tagline" placeholder="A short personal motto" />
        <TextArea path={['basics', 'summary']} label="Summary" rows={8} className="col-span-2" />
        <TextField
          path={['basics', 'email']}
          label="Email"
          type="email"
          hint="Left out of client PDFs unless you include it."
        />
        <TextField path={['basics', 'phone']} label="Phone" type="tel" />
      </div>
    </Section>
  )
}

const newTitled = (): TitledItem => ({ title: '' })

function TitledList({
  title,
  field,
  noun,
  intro,
}: {
  title: string
  field: 'x-strengths' | 'x-keyRoles' | 'x-keySkills'
  noun: string
  intro: string
}) {
  return (
    <ListSection<TitledItem>
      title={title}
      path={['basics', field]}
      noun={noun}
      intro={intro}
      newItem={newTitled}
      describe={(item) => item.title}
      renderItem={(_item, path) => (
        <div className="flex flex-col gap-3">
          <TextField path={[...path, 'title']} label="Title" />
          <TextArea path={[...path, 'description']} label="Description" rows={3} />
        </div>
      )}
    />
  )
}

export function StrengthsSection() {
  return (
    <TitledList
      title="In a nutshell"
      field="x-strengths"
      noun="strength"
      intro="Two or three strengths clients should remember. This opens the PDF."
    />
  )
}

export function KeyRolesSection() {
  return (
    <TitledList title="Key roles" field="x-keyRoles" noun="role" intro="Roles this person is typically hired for." />
  )
}

export function KeySkillsSection() {
  return (
    <TitledList title="Key skills" field="x-keySkills" noun="key skill" intro="The skills that make the difference." />
  )
}

export function KeywordsSection() {
  return (
    <Section title="Keywords & industries" paths={['basics.x-keywords', 'basics.x-industries']}>
      <SectionIntro>Shown as chips on the PDF cover and used by search filters.</SectionIntro>
      <div className="flex flex-col gap-4">
        <ChipsField path={['basics', 'x-keywords']} label="Keywords" />
        <ChipsField path={['basics', 'x-industries']} label="Industries" />
      </div>
    </Section>
  )
}
