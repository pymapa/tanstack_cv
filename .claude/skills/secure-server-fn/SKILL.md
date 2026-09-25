---
name: secure-server-fn
description: Recipe for adding or changing server-side entry points securely. Trigger when creating or modifying any createServerFn, a server route (src/routes/api/*), middleware (src/server/middleware/*), or the authorization policy (src/server/authz/policy.ts).
---

# Secure server function / server route

Spec refs: §2 (permissions), §5 (layering), §8 (server API, errors), §9 (security). If this
skill and `spec.md` disagree, the spec wins. Changing the authz matrix, auth/session config
or security headers/CSP needs **human approval** (AGENTS.md).

## 1. The pattern (every server fn, no exceptions)

```
globalMiddleware (request-id · headers · CSRF)          ← src/start.ts, once
  → authMiddleware        401 if no valid session; puts `actor` in context
  → validator(Zod)   400 on invalid input; limits on every field
  → handler (thin): can(actor, action, resource) → service(deps, input) → Result<T, AppError>
  → toDto(value)          never a DB row; only the fields the UI needs
  → errors → mapAppError  → { error, message, requestId } + status
```

- **Thin handler.** No business logic, no Drizzle, no SQL in `src/server/functions/`.
  Services in `src/server/services/` take deps (`db`, `clock`, `idGen`, `audit`) as args.
- **Default deny.** `can()` returns `false` for any unknown action/role/resource. Never
  write `if (role === 'admin')` in a handler; add the rule to `policy.ts` + its matrix test.
- **Load, then authorize.** Fetch the resource's owner (`personId`), then call
  `can(actor, action, { personId })`. Missing *or* denied → same `NOT_FOUND` (404), same
  message, same timing path, so ids can't be enumerated (§2).
- **Action-level denials** (the role can never perform the action, e.g. an expert calls
  `erasePerson` or `listUsers`): return `FORBIDDEN` (403). This is decided before any
  resource is loaded, so it reveals nothing about ids. Resource-level denials stay `NOT_FOUND`.
- **Scoped queries.** For lists/search, authorization is in SQL: experts get
  `WHERE person_id = :ownPersonId` from the repository. Never fetch all and filter in JS.
  An expert with no `personId` gets an empty result, not everything.
- **Methods.** `POST` for anything that writes. `GET` must be side-effect free (audit
  events are the only allowed write). CSRF middleware covers all non-GET calls.
- **Transactions.** Revision + pointer + facets/FTS + audit in one transaction (§6.2).

## 2. Input validation (Zod 4)

- One schema per boundary, `z.strictObject(...)` (reject unknown keys).
- Bound everything: `z.uuid()` for ids, `.max()` on every string (titles ≤ 300, messages
  ≤ 200/2000 per §8), `.max()` on arrays, `z.int().min().max()` for paging.
- CV payloads use `CvDocument` from `src/cv/schema.ts` (512 KB cap, read-only `meta.*`).
- Never trust client-sent ownership (`personId`, `authorId`, `role`); take them from context.

## 3. Errors, logging, audit, headers

- Services return `Result<T, AppError>`; `throw` only for bugs. The handler calls one
  helper (`src/server/errors.ts`) that maps `AppError` → status (400/401/403/404/409/429/503/500)
  and body `{ error: CODE, message: <generic>, field?, requestId }`. Unknown throws →
  `INTERNAL`, logged server-side with stack; the client never sees stack, SQL or Zod internals.
- **Logger** (`src/server/logger.ts`): structured JSON with `requestId`, `actorId`, action,
  outcome, duration. Redacted keys: `password`, `token`, `cookie`, `authorization`,
  `email`, `phone`, `data`. Never log CV content, names, prompts or model output.
- **Audit** (`audit_event`): write for reads of a CV, search (hashed terms), edits,
  exports, AI calls, admin actions, and **every denial** (`outcome: 'denied'`). `meta` holds
  ids/options only, never CV content. Write it from the service, inside the transaction.
- **Rate limit** (`src/server/middleware/rate-limit.ts`): login 5/15 min per email+IP,
  `aiPropose` 20/10 min per user, PDF export (per user). Exceeded → `RATE_LIMITED` (429).
- **Cache-Control: no-store** on every server fn response, server route and PDF
  (`setResponseHeaders` in the headers middleware; set explicitly on `new Response`).

## 4. Example: `saveCvRevision` (optimistic concurrency → 409)

```ts
// src/server/functions/cv.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { can } from '../authz/policy'
import { CvDocument } from '../../cv/schema'
import { saveRevision } from '../services/cv'
import { failWith, notFound } from '../errors'
import { toRevisionDto } from './dto'

const SaveCvRevisionInput = z.strictObject({
  cvId: z.uuid(),
  baseRevisionId: z.uuid(),
  data: CvDocument,
  message: z.string().trim().max(200).optional(),
})

export const saveCvRevision = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(SaveCvRevisionInput)
  .handler(async ({ data, context }) => {
    const { actor, deps, requestId } = context
    const owner = await deps.cvRepo.findOwner(data.cvId)            // { personId } | null
    if (owner === null || !can(actor, 'cv.update', owner)) {
      await deps.audit.denied({ actor, action: 'cv.update', targetId: data.cvId, requestId })
      return failWith(notFound(), requestId)                        // 404, same for both
    }
    const result = await saveRevision(deps, { actor, requestId, ...data })
    // service: in one tx → if cv.currentRevisionId !== baseRevisionId → err(CONFLICT)
    //          else insert revision, move pointer, rebuild facets/FTS, audit 'allowed'
    return result.ok ? toRevisionDto(result.value) : failWith(result.error, requestId)
  })
```

`failWith` calls `setResponseStatus(status)` and throws/returns the safe error body (pick
one convention in `errors.ts` and use it everywhere). `CONFLICT` → 409 and the UI shows a diff.

**Server route** (PDF, `src/routes/api/cvs.$cvId.pdf.ts`): same steps by hand, since route
handlers don't get `validator`: resolve session from `request` → 401; parse
`params` + `URL.searchParams` with Zod → 400; load owner + `can('cv.export')` → 404; call
service; return `new Response(bytes, { headers: { 'Content-Type': 'application/pdf',
'Cache-Control': 'no-store', 'Content-Disposition': safeDisposition(name) } })`; audit.

## 5. Required tests (integration, real in-memory SQLite, TDD: write them first)

For **every** new or changed server fn / route, in `tests/integration/functions/*.test.ts`:

1. `should return 401 when unauthenticated` (no session).
2. `should return 404 when <denied role> accesses another person's resource` (expert vs
   foreign CV) and a role without the action at all; body identical to a real 404.
3. `should return 400 when input is invalid` (bad uuid, over-long string, unknown key,
   oversized document); body has `error: 'VALIDATION'` and no Zod dump.
4. `should <do the thing> when authorized` (happy path, DTO shape, no extra fields).
5. `should write an audit event when <allowed|denied>` (assert action, outcome, no CV
   content in `meta`).
6. Specific cases: `saveCvRevision` stale `baseRevisionId` → 409; rate-limited fn → 429;
   GET fn leaves DB unchanged (except audit); `Cache-Control: no-store` on routes.

Also: add the action to the exhaustive `can()` matrix unit test (§11) when policy changes,
and an E2E "expert cannot open/export another CV" when touching CV access.

## 6. API notes (TanStack Start 1.168)

Verified by the caller against current docs: `createServerFn({ method })
.middleware([...]).validator(schema).handler(({ data, context }) => ...)` (it's
`validator`; the older `inputValidator` name is deprecated in 1.168 and logs a dev warning); `createMiddleware({ type: 'function' | 'request' })
.server(({ next, context }) => next({ context: {...} }))`; `getRequest`,
`getRequestHeader`, `setResponseHeaders`, `setResponseStatus` from
`@tanstack/react-start/server`; server routes via
`server: { handlers: { GET: async ({ request, params }) => Response } }`.
`createCsrfMiddleware(opts)` and `createStart(...)` are exported from `@tanstack/react-start`.
`createStart` takes `requestMiddleware` / `functionMiddleware` arrays, which is where the
global headers, CSRF, request-id and auth middleware get registered (checked in the package
typings). **Unverified:** whether thrown errors or returned values are the preferred error
channel. Decide once in `errors.ts`.

## Checklist

- [ ] `POST` if it writes; `GET` has no side effects except audit
- [ ] `authMiddleware` attached (global CSRF + headers + request-id already apply)
- [ ] Zod `strictObject` input with bounds on every string, array and number
- [ ] Ownership/role taken from `context`, never from input
- [ ] `can(actor, action, resource)` called; default deny; policy matrix test updated
- [ ] Missing and denied resources both → 404, same body
- [ ] Expert queries scoped in SQL; no fetch-all-then-filter
- [ ] Handler is thin: `can()` → service → DTO; no DB rows returned
- [ ] Multi-step writes in one transaction; optimistic concurrency where relevant (409)
- [ ] Errors mapped to `{ error, message, requestId }`; no stack/SQL/Zod internals
- [ ] Audit event for allowed and denied outcomes; no CV content in `meta`
- [ ] Logs redacted: no CV data, emails, phones, tokens, cookies, prompts
- [ ] Rate limit on login, AI, export (and any new expensive endpoint)
- [ ] `Cache-Control: no-store` on the response
- [ ] Tests: 401, 404 denied, 400 invalid, happy path, audit, plus 409/429 where relevant
- [ ] `pnpm verify` green; run the `owasp-review` skill before committing
