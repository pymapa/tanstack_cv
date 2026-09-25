import type { Skill } from '~/cv/schema'
import { ChipsField, TextField } from '../fields'
import { ListSection } from '../list-section'
import { getIn, type Path } from '../update'
import { useEditor } from '../editor-context'

type SkillDetail = NonNullable<Skill['x-skillDetails']>[number]

export function SkillsSection() {
  return (
    <ListSection<Skill>
      title="Skills"
      path={['skills']}
      noun="skill category"
      intro="Group technologies into categories. Years can be given per category or per technology."
      newItem={() => ({ name: '' })}
      describe={(skill) => skill.name}
      renderItem={(_skill, path) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_12rem] gap-3">
            <TextField path={[...path, 'name']} label="Category" />
            <TextField path={[...path, 'level']} label="Experience" placeholder="10+ years" />
          </div>
          <ChipsField path={[...path, 'keywords']} label="Keywords" />
          <SkillDetails path={[...path, 'x-skillDetails']} />
        </div>
      )}
    />
  )
}

/** Per-technology years, e.g. "React · 8 years". Rows are simple and ordered as entered. */
function SkillDetails({ path }: { path: Path }) {
  const { cv, set } = useEditor()
  const raw = getIn(cv, path)
  const rows: readonly SkillDetail[] = Array.isArray(raw) ? (raw as SkillDetail[]) : []

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium">Technologies with years</legend>
      {rows.map((row, index) => (
        // Rows only append/remove at known positions; index keys are stable enough here.
        <div key={index} className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
          <TextField path={[...path, index, 'name']} label="Technology" />
          <TextField path={[...path, index, 'yearsText']} label="Years" placeholder="5+ years" />
          <button
            type="button"
            onClick={() => {
              set(
                path,
                rows.filter((_, i) => i !== index),
              )
            }}
            aria-label={`Remove technology ${row.name || index + 1}`}
            className="mb-0.5 rounded-[5px] px-2 py-2 text-xs text-muted hover:bg-mist hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          set(path, [...rows, { name: '' }])
        }}
        className="self-start text-xs font-medium text-teal hover:underline"
      >
        Add technology
      </button>
    </fieldset>
  )
}
