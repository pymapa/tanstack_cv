import type { CvDocument } from '~/cv/schema'
import type { SearchableCv } from '~/cv/search'
import type { Result } from '~/lib/result'

export type RevisionSource = 'import' | 'manual' | 'ai' | 'restore' | 'duplicate'

export type CvRevision = Readonly<{
  id: string
  cvId: string
  number: number
  data: CvDocument
  source: RevisionSource
  message: string | undefined
  authorName: string
  createdAt: string
}>

export type RevisionSummary = Omit<CvRevision, 'data' | 'cvId'>

export type CvSummary = Readonly<{
  id: string
  variant: string
  label: string
  isPrimary: boolean
  /** null when unchanged since import. */
  updatedAt: string | null
  cvYear: string
  revisionNumber: number
}>

export type PersonView = Readonly<{
  id: string
  legacyId: string
  fullName: string
  employmentType: 'employee' | 'subcontractor'
  cvs: readonly CvSummary[]
}>

export type CvView = Readonly<{
  id: string
  person: Pick<PersonView, 'id' | 'fullName'>
  variant: string
  isPrimary: boolean
  revision: CvRevision
  revisions: readonly RevisionSummary[]
}>

export type SaveRevisionInput = Readonly<{
  cvId: string
  baseRevisionId: string
  data: CvDocument
  message?: string | undefined
  authorName: string
}>

export type SaveRevisionError = 'NOT_FOUND' | 'CONFLICT'

export type CreateVariantInput = Readonly<{
  sourceCvId: string
  variant: string
  data: CvDocument
  authorName: string
}>

export type CreateVariantError = 'NOT_FOUND' | 'VARIANT_TAKEN'

/**
 * Storage port. The in-memory adapter backs the UI until the Postgres adapter (spec M1) replaces it.
 * Implementations must keep revisions append-only.
 */
export interface CvRepository {
  listSearchable(): readonly SearchableCv[]
  getPerson(personId: string): PersonView | null
  getCv(cvId: string): CvView | null
  saveRevision(input: SaveRevisionInput): Result<CvRevision, SaveRevisionError>
  createVariant(input: CreateVariantInput): Result<CvRevision, CreateVariantError>
}
