import type { Skill } from '~/cv/schema'
import { skillTerms } from '~/cv/skills'
import { Chips, Section } from './common'

/** Bars are decoration next to a text label; 20+ years fills the bar. */
const MAX_YEARS = 20

const yearsLabel = (years: number | null | undefined, yearsText: string | undefined): string | undefined => {
  if (yearsText !== undefined && yearsText.trim() !== '') return yearsText
  if (years === null || years === undefined) return undefined
  if (years < 1) return `${Math.round(years * 12)} mo`
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}

function SkillGroup({ skill }: { skill: Skill }) {
  const { rows: details, keywords } = skillTerms(skill)
  return (
    <li className="skill-group">
      <h3>
        {skill.name}
        {skill.level !== undefined && <span>{skill.level}</span>}
      </h3>
      {details.length > 0 && (
        <ul>
          {details.map((d) => {
            const label = yearsLabel(d.years, d.yearsText)
            const ratio = typeof d.years === 'number' ? Math.min(d.years / MAX_YEARS, 1) : 0
            return (
              <li key={d.name} className="skill-row">
                <span>{d.name}</span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                </span>
                <span className="years">{label ?? ''}</span>
              </li>
            )
          })}
        </ul>
      )}
      <Chips items={keywords} />
    </li>
  )
}

export function Skills({ skills }: { skills: readonly Skill[] }) {
  if (skills.length === 0) return null
  return (
    <Section title="Skills">
      <ul className="skills">
        {skills.map((skill) => (
          <SkillGroup key={skill.name} skill={skill} />
        ))}
      </ul>
    </Section>
  )
}
