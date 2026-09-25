import type { Skill } from '~/cv/schema'
import { skillTerms } from '~/cv/skills'
import { Entry, InlineList, Section } from './common'

const yearsLabel = (years: number | null | undefined, yearsText: string | undefined): string | undefined => {
  if (yearsText !== undefined && yearsText.trim() !== '') return yearsText
  if (years === null || years === undefined) return undefined
  if (years < 1) return `${Math.round(years * 12)} mo`
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}

function SkillGroup({ skill }: { skill: Skill }) {
  const { rows: details, keywords } = skillTerms(skill)
  return (
    <Entry
      aside={
        <>
          <h3>{skill.name}</h3>
          {skill.level !== undefined && <p className="muted">{skill.level}</p>}
        </>
      }
    >
      {details.length > 0 && (
        <ul className="skill-list">
          {details.map((d) => {
            const label = yearsLabel(d.years, d.yearsText)
            return (
              <li key={d.name}>
                <span>{d.name}</span>
                {label !== undefined && <span className="years"> {label}</span>}
              </li>
            )
          })}
        </ul>
      )}
      <InlineList items={keywords} />
    </Entry>
  )
}

export function Skills({ skills }: { skills: readonly Skill[] }) {
  if (skills.length === 0) return null
  return (
    <Section title="Skills">
      <ul className="entries">
        {skills.map((skill) => (
          <SkillGroup key={skill.name} skill={skill} />
        ))}
      </ul>
    </Section>
  )
}
