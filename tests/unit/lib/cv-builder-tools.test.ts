import { describe, expect, it } from 'vitest'
import type { CvDocument } from '~/cv/schema'
import { CV_BUILDER_TOOL_DEFS, createCvBuilderClientTools } from '~/lib/ai/cv-builder-tools'
import { buildCv, buildProject } from '../../fixtures/cv'

/** A draft held like the page holds it: tools read and write through the same ref. */
const setup = (initial: CvDocument = buildCv()) => {
  const ref = { current: initial }
  const tools = createCvBuilderClientTools({
    get: () => ref.current,
    set: (next) => {
      ref.current = next
    },
  })
  const run = (name: string, input: unknown = {}) => {
    const tool = tools.find((t) => t.name === name)
    if (tool?.execute === undefined) throw new Error(`no client tool ${name}`)
    return (tool.execute as (i: unknown) => unknown)(input)
  }
  return { ref, run }
}

describe('CV builder tools', () => {
  it('should define the same tool names on the server and the client', () => {
    const clientNames = createCvBuilderClientTools({ get: buildCv, set: () => undefined }).map((t) => t.name)

    expect(CV_BUILDER_TOOL_DEFS.map((t) => t.name)).toEqual(clientNames)
  })

  it('should give the model the draft without contact details', async () => {
    const { run } = setup(buildCv({ basics: { email: 'anna@example.com' } }))

    const draft = await run('readDraft')

    expect(JSON.stringify(draft)).not.toContain('anna@example.com')
    expect(draft).toMatchObject({ basics: { name: 'Anna Example' } })
  })

  it('should apply an update to the draft and report what is left to fix', async () => {
    const { ref, run } = setup(buildCv({ basics: { name: '' } }))

    const result = await run('updateDraft', { basics: { label: 'Data engineer' }, projects: [buildProject()] })

    expect(ref.current.projects).toEqual([buildProject()])
    expect(result).toMatchObject({
      ok: true,
      updated: ['basics', 'projects'],
      problems: [{ path: 'basics.name', message: 'This field is required' }],
      brandFindings: expect.arrayContaining([expect.objectContaining({ field: 'basics.x-strengths' })]),
    })
  })

  it('should see its own earlier update when called twice in one turn', async () => {
    const { ref, run } = setup()

    await run('updateDraft', { basics: { label: 'Data engineer' } })
    await run('updateDraft', { skills: [{ name: 'Cloud' }] })

    expect(ref.current.basics.label).toBe('Data engineer')
    expect(ref.current.skills).toEqual([{ name: 'Cloud' }])
  })

  it('should leave the draft unchanged and explain when the update is invalid', async () => {
    const initial = buildCv()
    const { ref, run } = setup(initial)

    const result = await run('updateDraft', { basics: { email: 'x@example.com' }, projects: [{ name: 'No client' }] })

    expect(ref.current).toBe(initial)
    expect(result).toMatchObject({
      ok: false,
      problems: expect.arrayContaining([expect.objectContaining({ path: 'projects.0.entity' })]),
    })
  })

  it('should check the draft against the Kipinä style', async () => {
    const { run } = setup(buildCv({ basics: { summary: 'I am passionate!' } }))

    const result = (await run('checkBrand')) as { findings: Array<{ field: string }> }

    expect(result.findings.map((f) => f.field)).toContain('basics.summary')
  })
})
