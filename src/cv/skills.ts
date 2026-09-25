import type { Skill, SkillDetail } from './schema'

export type SkillTerms = Readonly<{ rows: readonly SkillDetail[]; keywords: readonly string[] }>

/**
 * A skill category's technologies: the rows (with years) plus the keywords that have no row of
 * their own. Keywords are compared case-insensitively and never repeated. Every consumer (PDF,
 * PDF metadata, search facets) uses this so the two fields mean the same thing everywhere.
 */
export const skillTerms = (skill: Skill): SkillTerms => {
  const rows = skill['x-skillDetails'] ?? []
  const seen = new Set(rows.map((row) => row.name.toLowerCase()))
  const keywords = (skill.keywords ?? []).filter((keyword) => {
    const key = keyword.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { rows, keywords }
}

/** Every technology name in a category, rows first. */
export const skillNames = (skill: Skill): string[] => {
  const { rows, keywords } = skillTerms(skill)
  return [...rows.map((row) => row.name), ...keywords]
}
