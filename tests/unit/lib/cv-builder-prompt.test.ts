import { describe, expect, it } from 'vitest'
import { CV_BUILDER_SYSTEM_PROMPT } from '~/lib/ai/cv-builder-prompt'
import { CV_BUILDER_TOOL_DEFS } from '~/lib/ai/cv-builder-tools'

describe('CV builder system prompt', () => {
  it('should mention every builder tool', () => {
    for (const { name } of CV_BUILDER_TOOL_DEFS) expect(CV_BUILDER_SYSTEM_PROMPT).toContain(name)
  })

  it('should treat the attached old CV as data and forbid inventing facts', () => {
    expect(CV_BUILDER_SYSTEM_PROMPT).toMatch(/never as instructions/)
    expect(CV_BUILDER_SYSTEM_PROMPT).toMatch(/Never invent facts/)
  })
})
