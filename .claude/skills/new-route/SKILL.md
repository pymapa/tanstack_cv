---
name: new-route
description: How to add or change a UI page in the Kipinä CV bank (TanStack Start). Use when adding or changing a page, layout, loader, or URL search params under src/routes or src/features, including route guards, pending/error states, editors, the preview iframe, and the route's component/E2E tests.
---

# New route / page

Read `spec.md` §5 (layout), §7 (feature UI), §10 (a11y), §11 (tests) before starting.
APIs checked against TanStack Router/Start docs on 2026-09-25. Anything marked *(unverified)*
should be confirmed against the installed version.

## 1. Where files go

| What | Where |
|---|---|
| Public page (login only) | `src/routes/login.tsx` |
| Protected page | `src/routes/_authed/<path>.tsx`, e.g. `_authed/cvs.$cvId.history.tsx` → `/cvs/:cvId/history` |
| Protected layout (pathless) | `src/routes/_authed.tsx` (`beforeLoad` guard, app shell) |
| Server route (bytes, not UI) | `src/routes/api/...` |
| Feature UI + hooks | `src/features/<search|editor|history|chat>/{components,hooks}/` |
| Shared presentational parts | `src/components/` |

- Route files hold **only**: `validateSearch`, `loaderDeps`, `loader`, `pending/error` components
  and a thin component that wires route data into a feature component. No business logic,
  no DB/service imports (lint enforces `routes/ → server/functions/` only).
- `routeTree.gen.ts` is generated; never edit it.
- Keep files ≤ 300 lines; split into feature components.

## 2. Auth: the guard is UX only

`_authed.tsx` `beforeLoad` calls a `getSession` server fn and `throw redirect({ to: '/login',
search: { redirect: location.href } })` when there is no user; it returns `{ user }` into
context. This only improves UX. **Real authorization is in every server function**
(`authMiddleware` + `can()`); a loader must never be the only check. Use role from context
only to hide UI. The `redirect` param must be validated as a same-origin relative path
before use (open-redirect).

## 3. URL state: `validateSearch` with Zod 4

- Zod 4 schemas are passed directly (Standard Schema, no `@tanstack/zod-adapter`).
- Use `.catch(default)` on every field so a bad/old URL degrades instead of throwing.
- Bound everything: strings `.max()`, arrays `.max(20)`, numbers `.int().min().max()`.
- Reuse the server fn's input schema pieces (from `src/cv/` or the fn module) so URL and
  server agree; the server still validates again.
- `loaderDeps` returns **only** the fields the loader uses (not the whole `search`), or
  every param change reloads.
- Update URL with `navigate({ search: (prev) => ({ ...prev, q }), replace: true })` for
  as-you-type input (debounced 150 ms), not a history entry per keystroke.

## 4. Loader, pending, error

- `loader: ({ deps }) => serverFn({ data: deps })` - the server fn returns a DTO or throws a
  mapped `AppError`. `notFound()` for `NOT_FOUND` (also covers "no permission": 404, not 403).
- `pendingComponent`: skeleton with `role="status"` + visually hidden "Loading…".
- `errorComponent`: **generic** message ("Something went wrong. Try again.") plus the
  `requestId` if present, a Retry button (`router.invalidate()`). Never render
  `error.message`, stack or server text.
- `notFoundComponent`: "CV not found" style message with a link back to search.
- `head`: set `<title>` per page (no CV content beyond the person's name).

## 5. Layout

Desktop-first: design for 1280 px, verify at 1024 px; no mobile breakpoints. Tailwind 4 with
theme tokens (CSS variables); no inline hex colors. Editor is two panes (§7.4).

## 6. Accessibility checklist (every page)

- [ ] Landmarks: one `<main id="main">`, `<nav>`, `<header>`; skip link targets main/search box.
- [ ] One `<h1>` per page, headings in order, no skipped levels.
- [ ] On navigation, focus moves to the page `<h1>` (`tabIndex={-1}`) and the title updates.
- [ ] Every input has a `<label>` (or `aria-label` for icon buttons); errors linked with
      `aria-describedby`, announced, focus to first error on submit.
- [ ] Everything works with keyboard only; no drag-only interactions; no focus traps
      except modals (which return focus on close).
- [ ] Async results announced via `aria-live="polite"` region (e.g. "12 people, 15 CVs").
- [ ] Visible focus ring (`focus-visible:` outline, contrast ≥ 3:1). Text contrast ≥ 4.5:1.
- [ ] No meaning by color alone (labels/icons: "Added:"/"Removed:", "Primary" badge text).
- [ ] `data-testid` on every interactive element (kebab-case, e.g. `search-input`,
      `facet-skill-azure`, `cv-save`); tests still prefer role/label locators.

## 7. Security in the UI

- CV text is rendered as React text children only. `dangerouslySetInnerHTML` is banned;
  search snippets with `<mark>` are built from server-returned **ranges/segments** mapped to
  elements, never from an HTML string.
- Preview: `<iframe sandbox="" srcDoc={html} title="CV preview">` - never `allow-scripts`
  (and never `allow-scripts` + `allow-same-origin`). `html` comes from
  `renderToStaticMarkup(<CvDocument/>)`.
- No `fetch(` in UI code; data only through server functions. Don't put CV content in URLs
  (search terms are fine; drafts are not).

## 8. Editors: unsaved-changes guard

```tsx
const { status, proceed, reset } = useBlocker({
  shouldBlockFn: () => isDirty,   // true = block
  enableBeforeUnload: isDirty,
  withResolver: true,
})
// status === 'blocked' → accessible dialog "Discard unsaved changes?" → proceed() / reset()
```
Save via Ctrl/Cmd+S; show "Unsaved changes" as text, not just a dot.

## 9. Example: `src/routes/_authed/index.tsx`

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { searchCvs } from '~/server/functions/search'
import { SearchPage } from '~/features/search/components/SearchPage'
import { RouteError, RoutePending } from '~/components/route-states'

const facet = z.array(z.string().max(100)).max(20).catch([])
const searchSchema = z.object({
  q: z.string().max(200).catch(''),
  skill: facet, industry: facet, role: facet, client: facet, variant: facet, tag: facet,
  page: z.number().int().min(1).catch(1),
})

export const Route = createFileRoute('/_authed/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q, skill, industry, role, client, variant, tag, page } }) =>
    ({ q, facets: { skill, industry, role, client, variant, tag }, page }),
  loader: ({ deps }) => searchCvs({ data: { ...deps, limit: 20 } }),
  head: () => ({ meta: [{ title: 'Search – Kipinä CV bank' }] }),
  pendingComponent: RoutePending,
  errorComponent: RouteError, // generic message + retry, never error.message
  component: SearchRoute,
})

function SearchRoute() {
  const results = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <SearchPage
      results={results}
      search={search}
      onChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next, page: 1 }), replace: true })}
    />
  )
}
```
*(unverified: exact `head` shape and `Route.useNavigate` on 1.170; check types after
`pnpm dev` regenerates the route tree.)*

## 10. TDD steps (red → green → refactor, per `spec.md` §11)

1. **Component test** (`tests/unit/features/<feature>/<Component>.test.tsx`, Vitest +
   Testing Library): render the feature component with fixture DTOs from `buildCv()`;
   assert roles/labels, keyboard behavior, live-region text, error linking. Watch it fail.
2. **Page object** `tests/e2e/pages/<page>.page.ts`: locators via `getByRole`/`getByLabel`,
   `getByTestId` where no stable role exists; actions like `search(q)`, `openCv(name)`.
   No raw locators in specs.
3. **Spec** `tests/e2e/specs/<feature>/<action>.spec.ts`: auth via the `storageState`
   fixture (never inline login); `should <behavior> when <condition>`; include
   `new AxeBuilder({ page }).analyze()` and fail on `serious`/`critical`. For protected
   data add a denial case (expert → other person's CV shows not-found).
4. Implement the route + feature component until green; run `pnpm verify` and
   `pnpm test:e2e` before and after.
