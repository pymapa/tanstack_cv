import { defaultStringifySearch } from '@tanstack/react-router'
import type { SearchableCv } from '~/cv/search'
import type { IndexPerson } from '~/lib/cv-data'

export type CvLink = Readonly<{ file: string; name: string; variant: string; url: string }>

export type CvLinks = Readonly<{
  cvs: readonly CvLink[]
  filterUrl: string | null
  notFound: readonly string[]
}>

const findCv = (
  people: readonly IndexPerson[],
  entries: readonly SearchableCv[],
  file: string,
): (CvLink & { cvId: string }) | null => {
  const person = people.find((p) => p.versions.some((v) => v.file === file))
  const version = person?.versions.find((v) => v.file === file)
  if (person === undefined || version === undefined) return null
  const cv = entries.find((e) => e.document.meta.personId === person.personId && e.variant === version.variant)
  if (cv === undefined) return null
  return { file, name: person.name, variant: version.variant, url: `/cvs/${cv.cvId}`, cvId: cv.cvId }
}

export const buildCvLinks = (
  people: readonly IndexPerson[],
  entries: readonly SearchableCv[],
  files: readonly string[],
): CvLinks => {
  const unique = [...new Set(files)]
  const found = unique.map((file) => ({ file, cv: findCv(people, entries, file) }))
  const cvs = found.flatMap(({ cv }) => (cv === null ? [] : [cv]))
  return {
    cvs: cvs.map(({ cvId: _cvId, ...link }) => link),
    filterUrl: cvs.length === 0 ? null : `/${defaultStringifySearch({ cv: cvs.map((c) => c.cvId) })}`,
    notFound: found.flatMap(({ file, cv }) => (cv === null ? [file] : [])),
  }
}
