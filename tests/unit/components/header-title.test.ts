import { describe, expect, it } from 'vitest'
import { headerTitle, pickHeaderTitle, rendersOwnHeader } from '~/components/header-title'

const personTitle = headerTitle((person: { fullName: string }) => ({ title: person.fullName }))

describe('pickHeaderTitle', () => {
  it('should return nothing when no route declares a header title', () => {
    expect(pickHeaderTitle([{ staticData: {}, loaderData: undefined }])).toBeUndefined()
  })

  it('should use the deepest route that declares a header title', () => {
    const cvTitle = headerTitle((cv: { variant: string }) => ({ title: 'Anna Example', subtitle: cv.variant }))

    const title = pickHeaderTitle([
      { staticData: { headerTitle: personTitle }, loaderData: { fullName: 'Parent' } },
      { staticData: { headerTitle: cvTitle }, loaderData: { variant: 'default' } },
      { staticData: {}, loaderData: undefined },
    ])

    expect(title).toEqual({ title: 'Anna Example', subtitle: 'default' })
  })

  it('should return nothing while the route has no loader data yet', () => {
    expect(pickHeaderTitle([{ staticData: { headerTitle: personTitle }, loaderData: undefined }])).toBeUndefined()
  })
})

describe('rendersOwnHeader', () => {
  it('should be true when a matched route renders its own header', () => {
    expect(rendersOwnHeader([{ staticData: {} }, { staticData: { ownHeader: true } }])).toBe(true)
  })

  it('should be false when no matched route renders its own header', () => {
    expect(rendersOwnHeader([{ staticData: {} }])).toBe(false)
  })
})
