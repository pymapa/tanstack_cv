import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { CvDocument } from '~/cv/schema'
import { err, ok, type Result } from '~/lib/result'

const SampleIndex = z.object({
  people: z.array(
    z.object({
      personId: z.string().regex(/^p[0-9]{2}$/),
      name: z.string().min(1).max(300),
      primary: z.string().regex(/^p[0-9]{2}-v[0-9]+\.json$/),
      versions: z.array(z.object({ file: z.string().regex(/^p[0-9]{2}-v[0-9]+\.json$/) })).min(1),
    }),
  ),
})

export type ImportedVersion = Readonly<{ document: CvDocument; isPrimary: boolean }>
export type ImportedPerson = Readonly<{ legacyId: string; fullName: string; versions: readonly ImportedVersion[] }>

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'))

/**
 * Reads sample_data/index.json + cvs/*.json and validates everything.
 * All-or-nothing: any invalid file fails the whole load (spec §6.3).
 * Error messages name files and field paths only, never CV content.
 */
export const loadSampleData = async (dir: string): Promise<Result<ImportedPerson[], string>> => {
  try {
    const index = SampleIndex.safeParse(await readJson(join(dir, 'index.json')))
    if (!index.success) return err(`index.json is invalid: ${index.error.issues[0]?.path.join('.') ?? ''}`)

    const people: ImportedPerson[] = []
    for (const person of index.data.people) {
      const versions: ImportedVersion[] = []
      for (const { file } of person.versions) {
        const parsed = CvDocument.safeParse(await readJson(join(dir, 'cvs', file)))
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          return err(`${file} is invalid at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? ''}`)
        }
        versions.push({ document: parsed.data, isPrimary: file === person.primary })
      }
      people.push({ legacyId: person.personId, fullName: person.name, versions })
    }
    return ok(people)
  } catch (e) {
    const code = e instanceof Error && 'code' in e ? String(e.code) : 'UNKNOWN'
    return err(`Could not read sample data (${code})`)
  }
}
