export type HeaderTitle = Readonly<{ title: string; subtitle?: string; personId?: string }>

type HeaderTitleFn = (loaderData: unknown) => HeaderTitle | undefined

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    headerTitle?: HeaderTitleFn
  }
}

type TitledMatch = Readonly<{ staticData: { headerTitle?: HeaderTitleFn }; loaderData?: unknown }>

// staticData can't see the route's loader type, so the route supplies it here.
export const headerTitle =
  (select: (data: never) => HeaderTitle): HeaderTitleFn =>
  (loaderData) =>
    loaderData === undefined ? undefined : select(loaderData as never)

export const pickHeaderTitle = (matches: readonly TitledMatch[]): HeaderTitle | undefined =>
  matches.reduce<HeaderTitle | undefined>(
    (found, match) => match.staticData.headerTitle?.(match.loaderData) ?? found,
    undefined,
  )
