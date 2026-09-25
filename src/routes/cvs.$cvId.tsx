import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { CvWorkspace, type SaveRequest } from '~/features/cv/components/cv-workspace'
import { TranslationReview, type SaveTranslationRequest } from '~/features/translation/components/translation-review'
import { getCvFn, saveCvRevisionFn, saveTranslationFn, translateCvFn } from '~/server/functions/cv'
import type { TranslationDraft } from '~/server/services/cv-translation'

export const Route = createFileRoute('/cvs/$cvId')({
  loader: ({ params }) => getCvFn({ data: { cvId: params.cvId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.person.fullName ?? 'CV'} · ${loaderData?.variant ?? ''} · Kipinä CV bank` }],
  }),
  component: CvRoute,
})

function CvRoute() {
  const cv = Route.useLoaderData()
  // Remount per CV so drafts and translations never leak between CVs.
  return <CvPage key={cv.id} />
}

function CvPage() {
  const cv = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [translation, setTranslation] = useState<TranslationDraft | null>(null)

  const onSave = useCallback((request: SaveRequest) => saveCvRevisionFn({ data: { cvId: cv.id, ...request } }), [cv.id])
  // Refresh loader data (history, revision) only after the workspace has recorded the save.
  const refresh = useCallback(() => void router.invalidate(), [router])
  const onTranslate = useCallback(() => translateCvFn({ data: { cvId: cv.id } }), [cv.id])
  const onSaveTranslation = useCallback(
    (request: SaveTranslationRequest) => saveTranslationFn({ data: { sourceCvId: cv.id, ...request } }),
    [cv.id],
  )
  const onTranslationSaved = useCallback(
    (cvId: string) => void navigate({ to: '/cvs/$cvId', params: { cvId } }),
    [navigate],
  )

  if (translation !== null) {
    return (
      <TranslationReview
        person={cv.person}
        sourceVariant={cv.variant}
        original={cv.revision.data}
        draft={translation}
        onSave={onSaveTranslation}
        onSaved={onTranslationSaved}
        onDiscard={() => {
          setTranslation(null)
        }}
      />
    )
  }
  return (
    <CvWorkspace cv={cv} onSave={onSave} onRefresh={refresh} onTranslate={onTranslate} onTranslated={setTranslation} />
  )
}
