import { createFileRoute } from '@tanstack/react-router'
import { headerTitle } from '~/components/header-title'
import { PersonPage } from '~/features/people/components/person-page'
import { getPersonFn } from '~/server/functions/cv'

export const Route = createFileRoute('/people/$personId')({
  loader: ({ params }) => getPersonFn({ data: { personId: params.personId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.fullName ?? 'Person'} · Kipinä CV bank` }],
  }),
  staticData: { headerTitle: headerTitle((person: { fullName: string }) => ({ title: person.fullName })) },
  component: PersonRoute,
})

function PersonRoute() {
  return <PersonPage person={Route.useLoaderData()} />
}
