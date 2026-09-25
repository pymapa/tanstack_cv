import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { CvWorkspace, type SaveRequest } from '~/features/cv/components/cv-workspace'
import { getCvFn, saveCvRevisionFn } from '~/server/functions/cv'

export const Route = createFileRoute('/cvs/$cvId')({
  loader: ({ params }) => getCvFn({ data: { cvId: params.cvId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.person.fullName ?? 'CV'} · ${loaderData?.variant ?? ''} · Kipinä CV bank` }],
  }),
  component: CvRoute,
})

function CvRoute() {
  const cv = Route.useLoaderData()
  const router = useRouter()
  const onSave = useCallback(
    async (request: SaveRequest) => {
      const result = await saveCvRevisionFn({ data: { cvId: cv.id, ...request } })
      if (result.ok) await router.invalidate()
      return result
    },
    [cv.id, router],
  )
  const onReload = useCallback(() => void router.invalidate(), [router])
  // Remount per CV so drafts never leak between CVs.
  return <CvWorkspace key={cv.id} cv={cv} onSave={onSave} onReload={onReload} />
}
