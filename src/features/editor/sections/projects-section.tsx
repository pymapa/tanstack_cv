import type { Project } from '~/cv/schema'
import { CheckboxField, ChipsField, DateField, TextArea, TextField } from '../fields'
import { ListSection } from '../list-section'

export function ProjectsSection() {
  return (
    <ListSection<Project>
      title="Projects"
      path={['projects']}
      noun="project"
      intro="Newest first. Highlighted projects get their own page in the PDF."
      newItem={() => ({ name: '', entity: '' })}
      describe={(project) => project.name}
      renderItem={(_project, path, index) => (
        <div className="grid grid-cols-2 gap-3">
          <TextField path={[...path, 'name']} label="Project" className="col-span-2" />
          <TextField path={[...path, 'entity']} label="Client" />
          <TextField path={[...path, 'x-industry']} label="Client industry" placeholder="retail bank" />
          <TextField
            path={[...path, 'x-employer']}
            label="Employer"
            hint="Only if not Kipinä."
            className="col-span-2"
          />
          <DateField path={[...path, 'startDate']} label="Start" />
          <DateField path={[...path, 'endDate']} label="End" hint="Empty = ongoing" />
          <ChipsField path={[...path, 'roles']} label="Roles" className="col-span-2" />
          <TextArea path={[...path, 'description']} label="Description" rows={6} className="col-span-2" />
          <ChipsField path={[...path, 'keywords']} label="Technologies & methods" className="col-span-2" />
          <CheckboxField
            path={[...path, 'x-highlight']}
            label="Include in highlights"
            testId={`projects-${index}-highlight`}
            className="col-span-2"
          />
        </div>
      )}
    />
  )
}
