import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { CvDocument } from '~/cv/schema'
import { NewCvWorkspace } from '~/features/cv/components/new-cv-workspace'
import { createCvFn } from '~/server/functions/cv'

export const Route = createFileRoute('/cvs/new')({
  staticData: { hideCvAssistant: true },
  head: () => ({ meta: [{ title: 'New CV · Kipinä CV bank' }] }),
  component: NewCvRoute,
})

function NewCvRoute() {
  const navigate = Route.useNavigate()
  const onCreate = useCallback((data: CvDocument) => createCvFn({ data: { data } }), [])
  const onCreated = useCallback((cvId: string) => void navigate({ to: '/cvs/$cvId', params: { cvId } }), [navigate])
  return <NewCvWorkspace cvYear={String(new Date().getFullYear())} onCreate={onCreate} onCreated={onCreated} />
}
