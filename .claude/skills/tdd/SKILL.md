---
name: tdd
description: Mandatory test-driven workflow for the Kipinä CV bank. Use any time you implement a feature, fix a bug, or change behavior in this repo, before writing any production code. Covers the red-green-refactor loop, choosing the test layer (unit, component, integration, E2E), fixtures, fakes and anti-patterns.
---

# TDD for the Kipinä CV bank

No production code without a test that failed first (spec §11). This applies to features,
bug fixes and behavior changes. Pure refactors keep the existing tests green and add none.

## The loop

1. **Baseline.** Run `pnpm test`. If it is already red, stop and report; don't build on a
   broken suite.
2. **Pick the layer** (table below) and the smallest behavior to prove next.
3. **Red.** Write one failing test. Run only it (`pnpm test <file>` or `pnpm test:watch`).
4. **Confirm the reason.** It must fail on the assertion you wrote, not on a typo, missing
   import or wrong setup. A test that fails for the wrong reason proves nothing.
5. **Green.** Write the minimal code that makes it pass. No speculative options or fields.
6. **Refactor.** Clean up code and test (names, duplication, types) while staying green.
7. Repeat 3–6 until the behavior is complete, including error paths and authz denials.
8. **Verify.** Run `pnpm verify` (typecheck + lint + tests + audit + secret scan + build).
   For UI flows also run `pnpm test:e2e`. Don't commit until both are green.

**Bug fix = regression test first.** Reproduce the bug as a failing test at the lowest layer
that shows it, confirm it fails, then fix. Name it after the behavior, not the ticket.

## Choose the layer

| Layer | Tool | Location | Use for |
|---|---|---|---|
| Unit (~70%) | Vitest | `tests/unit/` | Pure logic: `can()`, Zod schemas, `patch.ts`, `diff.ts`, FTS query builder, `search-text.ts`, minimizer, filename sanitizer, error mapper |
| Component | Vitest + Testing Library + jsdom | `tests/unit/` (`*.test.tsx`) | Form sections, diff cards, facet list: keyboard behavior, labels, `aria-describedby` |
| Integration (~20%) | Vitest + in-memory SQLite | `tests/integration/` | Services and server-function handlers with the real DB, transactions, 409 conflicts, import, Chromium PDF render |
| E2E (~10%) | Playwright | `tests/e2e/{pages,fixtures,specs}/` | Critical flows only: login, search → edit → save → export, AI propose → apply, expert can't open others' CVs |

Push each test to the lowest layer that can prove the behavior. An E2E test that only
checks logic a unit test could cover is wasted time.

## Writing tests

- **Name:** `should <behavior> when <condition>`, e.g.
  `should return 404 when expert opens another person's CV`.
- **Structure:** Arrange-Act-Assert, separated by blank lines. One behavior per test.
- **Test data:** build CVs with `buildCv({ ...overrides })` from `tests/fixtures/`. Never
  copy sample files by hand. Only integration tests may load `sample_data/` directly.
  Fixtures are fictional; never add real personal data.
- **Dependencies are injected, not mocked globally.** Services take `db`, `clock`, `idGen`
  and `provider` as arguments. Pass a fixed clock (`() => new Date('2026-01-01T00:00:00Z')`)
  and a sequential `idGen`. Don't use `vi.mock` of modules or fake timers for code you own.
- **LLM:** always the `fake` provider. Tests never call the network. The Anthropic contract
  test runs only with `RUN_LLM_CONTRACT_TESTS=1` and is excluded from `pnpm verify`.
- **Security is behavior:** every server function gets tests for 401 (no session), denied
  role (404 for resources the user may not know exist), and invalid input (Zod rejection).

### Unit: table-driven `can()`

```ts
import { describe, expect, it } from 'vitest'
import { can } from '../../src/server/authz/policy'
import { buildActor, buildCvResource } from '../fixtures/actors'

const own = buildCvResource({ personId: 'p-own' })
const other = buildCvResource({ personId: 'p-other' })

describe('can', () => {
  it.each([
    { role: 'sales', action: 'cv.update', resource: other, expected: true },
    { role: 'expert', action: 'cv.update', resource: own, expected: true },
    { role: 'expert', action: 'cv.update', resource: other, expected: false },
    { role: 'sales', action: 'person.erase', resource: other, expected: false },
    { role: 'admin', action: 'audit.read', resource: other, expected: true },
  ] as const)(
    'should return $expected when $role does $action',
    ({ role, action, resource, expected }) => {
      const actor = buildActor({ role, personId: 'p-own' })

      const result = can(actor, action, resource)

      expect(result).toBe(expected)
    },
  )
})
```

Cover the full matrix from spec §2, plus an unknown action and unknown role (default deny).

### Integration: in-memory SQLite, migrated per file

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../fixtures/db'
import { buildCv, seqIds } from '../fixtures/cv'
import { createCv, saveRevision } from '../../src/server/services/cv'

describe('saveRevision', () => {
  let db: TestDb
  const deps = () => ({ db, clock: () => new Date('2026-01-01T00:00:00Z'), idGen: seqIds() })

  beforeEach(() => {
    db = createTestDb() // new ':memory:' db, runs src/db/migrations, pragmas on
  })

  it('should fail with CONFLICT when baseRevisionId is stale', () => {
    const cv = createCv(deps(), { personId: 'p1', variant: 'default', data: buildCv() })
    saveRevision(deps(), { cvId: cv.id, baseRevisionId: cv.currentRevisionId, data: buildCv({ basics: { label: 'PM' } }) })

    const result = saveRevision(deps(), { cvId: cv.id, baseRevisionId: cv.currentRevisionId, data: buildCv() })

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'CONFLICT' }) })
  })
})
```

Each test gets a fresh DB; never share rows between tests.

### E2E: Playwright rules

- **Page Object Model** in `tests/e2e/pages/` (e.g. `search.page.ts`, `editor.page.ts`).
  Specs in `tests/e2e/specs/<feature>/<action>.spec.ts` never use raw locators.
- **Auth via fixture:** `tests/e2e/fixtures/auth.fixture.ts` provides per-role
  `storageState` (admin, sales, expert). Never log in inline, except in the login spec itself.
- **Locators, in order:** `getByRole` → `getByLabel` → `getByTestId`. Never CSS classes,
  `.nth()`, XPath or copy text that may change. Add `data-testid` to new interactive elements.
- **Accessibility:** every spec runs `expectNoSeriousA11yViolations(page)`
  (`tests/e2e/fixtures/a11y.ts`) on each page it visits; serious and critical violations fail the
  test. It excludes the sandboxed preview iframe (axe would hang on it).
- **Wait for hydration** before interacting: page objects call `waitForApp(page)`
  (`tests/e2e/fixtures/app.ts`, which waits for `html[data-hydrated]`) after every navigation. A
  cold dev server otherwise swallows the first clicks and keystrokes.
- `pnpm test:e2e` starts its own dev server on port 3200.
- The app starts with a fresh DB and `AI_PROVIDER=fake`. Each test creates the data it needs.

## Anti-patterns (reject in review)

- **Skipping red:** writing the code first, or never seeing the test fail.
- **Testing implementation details:** asserting on private functions, internal state, call
  counts of helpers or component internals. Assert on outputs, DB state, rendered roles/text.
- **Snapshot abuse:** large DOM or object snapshots that get re-approved blindly. Snapshots
  are allowed only for the versioned AI system prompt (spec §7.6).
- **Time-dependent tests:** `new Date()`, `Date.now()`, real timers or `sleep`. Inject the
  clock; in Playwright wait on locators and `expect`, never `waitForTimeout`.
- **Shared mutable state:** module-level fixtures mutated across tests, a shared DB, or
  order-dependent tests.
- **Global mocks** of modules you own instead of injecting the dependency.
- **Network in tests:** any real HTTP call, CDN font, or the real LLM.
- **Weakened tests:** `.skip`, `.only`, loosened assertions or deleted cases to get green.

## Coverage targets

- 90%+ lines in `src/cv/` and `src/server/authz/`.
- 80%+ lines in `src/server/services/`.
- Coverage is a floor, not a goal: every branch that matters (errors, denials, limits,
  injection cases) needs a named test.
