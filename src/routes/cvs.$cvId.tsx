import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { CvWorkspace, type SaveAsNewRequest, type SaveRequest } from '~/features/cv/components/cv-workspace'
import { createCvVariantFn, getCvFn, saveCvRevisionFn } from '~/server/functions/cv'

export const Route = createFileRoute('/cvs/$cvId')({
  loader: ({ params }) => getCvFn({ data: { cvId: params.cvId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.person.fullName ?? 'CV'} · ${loaderData?.variant ?? ''} · Kipinä CV bank` }],
  }),
  staticData: { ownHeader: true },
  component: CvRoute,
})

function CvRoute() {
  const cv = Route.useLoaderData()
  const router = useRouter()
  const onSave = useCallback((request: SaveRequest) => saveCvRevisionFn({ data: { cvId: cv.id, ...request } }), [cv.id])
  const navigate = Route.useNavigate()
  const onSaveAsNew = useCallback(
    async (request: SaveAsNewRequest) => {
      const result = await createCvVariantFn({ data: { sourceCvId: cv.id, ...request } })
      if (result.ok) void navigate({ to: '/cvs/$cvId', params: { cvId: result.cvId }, ignoreBlocker: true })
      return result
    },
    [cv.id, navigate],
  )
  // Refresh loader data (history, revision) only after the workspace has recorded the save.
  const refresh = useCallback(() => void router.invalidate(), [router])
  // Remount per CV so drafts never leak between CVs.
  return <CvWorkspace key={cv.id} cv={cv} onSave={onSave} onSaveAsNew={onSaveAsNew} onRefresh={refresh} />
}
