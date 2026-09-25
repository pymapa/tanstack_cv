import type { CvDocument } from '~/cv/schema'
import type { SearchableCv } from '~/cv/search'
import { err, ok } from '~/lib/result'
import type { ImportedPerson } from '../import/sample-data'
import type { CvRepository, CvRevision, CvSummary, PersonView } from './cv-repository'

type Deps = Readonly<{ clock: () => Date; idGen: () => string }>

type StoredPerson = Readonly<{ id: string; legacyId: string; fullName: string; employmentType: 'employee' }>
type StoredCv = Readonly<{ id: string; personId: string; variant: string; revisions: readonly CvRevision[] }>

/** Import time isn't a real edit date, so imported-and-untouched CVs report null. */
const lastEditedAt = (rev: CvRevision): string | null => (rev.source === 'import' ? null : rev.createdAt)

const current = (cv: StoredCv): CvRevision => {
  const last = cv.revisions.at(-1)
  if (last === undefined) throw new Error(`CV ${cv.id} has no revisions`)
  return last
}

/** Server-managed fields: always taken from the previous revision, never from the client (spec §6.1). */
const keepManagedFields = (previous: CvDocument, next: CvDocument): CvDocument => {
  const { 'x-conversionNotes': _clientNotes, ...clientMeta } = next.meta
  const notes = previous.meta['x-conversionNotes']
  return {
    ...next,
    meta: {
      ...clientMeta,
      personId: previous.meta.personId,
      sourceFormat: previous.meta.sourceFormat,
      ...(notes === undefined ? {} : { 'x-conversionNotes': notes }),
    },
  }
}

export const createMemoryCvRepository = (seed: readonly ImportedPerson[], { clock, idGen }: Deps): CvRepository => {
  const people = new Map<string, StoredPerson>()
  const cvs = new Map<string, StoredCv>()
  const primaryByPerson = new Map<string, string>()

  const importedAt = clock().toISOString()
  for (const person of seed) {
    const personId = idGen()
    people.set(personId, {
      id: personId,
      legacyId: person.legacyId,
      fullName: person.fullName,
      employmentType: 'employee',
    })
    for (const version of person.versions) {
      const cvId = idGen()
      const revision: CvRevision = {
        id: idGen(),
        cvId,
        number: 1,
        data: version.document,
        source: 'import',
        message: 'Imported from sample data',
        authorName: 'Import',
        createdAt: importedAt,
      }
      cvs.set(cvId, { id: cvId, personId, variant: version.document.meta.variant, revisions: [revision] })
      if (version.isPrimary) primaryByPerson.set(personId, cvId)
    }
  }

  const summarize = (cv: StoredCv): CvSummary => {
    const rev = current(cv)
    return {
      id: cv.id,
      variant: cv.variant,
      label: rev.data.basics.label,
      isPrimary: primaryByPerson.get(cv.personId) === cv.id,
      updatedAt: lastEditedAt(rev),
      cvYear: rev.data.meta['x-cvYear'],
      revisionNumber: rev.number,
    }
  }

  const cvsOf = (personId: string): StoredCv[] => [...cvs.values()].filter((cv) => cv.personId === personId)

  const sameVariant = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

  return {
    listSearchable: () =>
      [...cvs.values()].map((cv): SearchableCv => {
        const rev = current(cv)
        return {
          cvId: cv.id,
          personId: cv.personId,
          personName: people.get(cv.personId)?.fullName ?? rev.data.basics.name,
          variant: cv.variant,
          isPrimary: primaryByPerson.get(cv.personId) === cv.id,
          updatedAt: lastEditedAt(rev),
          document: rev.data,
          tags: [],
        }
      }),

    getPerson: (personId): PersonView | null => {
      const person = people.get(personId)
      if (person === undefined) return null
      const summaries = cvsOf(personId)
        .map(summarize)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.variant.localeCompare(b.variant))
      return { ...person, cvs: summaries }
    },

    getCv: (cvId) => {
      const cv = cvs.get(cvId)
      const person = cv === undefined ? undefined : people.get(cv.personId)
      if (cv === undefined || person === undefined) return null
      return {
        id: cv.id,
        person: { id: person.id, fullName: person.fullName },
        variant: cv.variant,
        isPrimary: primaryByPerson.get(cv.personId) === cv.id,
        revision: current(cv),
        revisions: [...cv.revisions].reverse().map(({ data: _data, cvId: _cvId, ...summary }) => summary),
      }
    },

    saveRevision: ({ cvId, baseRevisionId, data, message, authorName }) => {
      const cv = cvs.get(cvId)
      if (cv === undefined) return err('NOT_FOUND')
      const head = current(cv)
      if (head.id !== baseRevisionId) return err('CONFLICT')
      const revision: CvRevision = {
        id: idGen(),
        cvId,
        number: head.number + 1,
        data: keepManagedFields(head.data, data),
        source: 'manual',
        message,
        authorName,
        createdAt: clock().toISOString(),
      }
      cvs.set(cvId, { ...cv, revisions: [...cv.revisions, revision] })
      return ok(revision)
    },

    createVariant: ({ sourceCvId, variant, data, authorName }) => {
      const source = cvs.get(sourceCvId)
      if (source === undefined) return err('NOT_FOUND')
      const name = variant.trim()
      if (cvsOf(source.personId).some((cv) => sameVariant(cv.variant, name))) return err('VARIANT_TAKEN')
      const head = current(source)
      const cvId = idGen()
      const managed = keepManagedFields(head.data, data)
      const revision: CvRevision = {
        id: idGen(),
        cvId,
        number: 1,
        data: { ...managed, meta: { ...managed.meta, variant: name } },
        source: 'duplicate',
        message: `Created from ${source.variant}, revision ${String(head.number)}`,
        authorName,
        createdAt: clock().toISOString(),
      }
      cvs.set(cvId, { id: cvId, personId: source.personId, variant: name, revisions: [revision] })
      return ok(revision)
    },

    createCvFrom: ({ sourceCvId, variant, data, source, message, authorName }) => {
      const origin = cvs.get(sourceCvId)
      if (origin === undefined) return err('NOT_FOUND')
      const taken = cvsOf(origin.personId).some((cv) => cv.variant.toLowerCase() === variant.toLowerCase())
      if (taken) return err('VARIANT_TAKEN')
      const cvId = idGen()
      const withManaged = keepManagedFields(current(origin).data, data)
      const revision: CvRevision = {
        id: idGen(),
        cvId,
        number: 1,
        data: { ...withManaged, meta: { ...withManaged.meta, variant } },
        source,
        message,
        authorName,
        createdAt: clock().toISOString(),
      }
      cvs.set(cvId, { id: cvId, personId: origin.personId, variant, revisions: [revision] })
      return ok({ cvId })
    },
  }
}
