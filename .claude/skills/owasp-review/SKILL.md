---
name: owasp-review
description: Project-specific security review (OWASP Top 10:2025, OWASP LLM Top 10, GDPR) for the Kipinä CV bank. Trigger before committing or opening a PR, after touching auth/authz/server functions/middleware/AI/PDF/dependencies/config, or when asked for a security review or audit of this repo.
---

# OWASP review: Kipinä CV bank

Controls: `spec.md` §9, §12, §13. CV data is real personal data (`AGENTS.md`): never paste it
into findings, URLs or external tools. Cite `file:line` and field names only.

## 1. Scope

- **Diff review (default):** `git diff main...HEAD --stat` plus `git status --short` (uncommitted work).
- **Full audit (periodic or on request):** treat all of `src/`, `scripts/`, `tests/` and root config as changed.

Sort each changed file into categories, then run their checks (§2; `ai` files: §4):

| Category | Paths |
|---|---|
| server-fn / route | `src/server/functions/**`, `src/routes/api/**`, route loaders |
| middleware | `src/server/middleware/**`, `src/server/errors.ts`, `src/server/logger.ts` |
| authz | `src/server/authz/**` |
| db | `src/db/**`, `src/server/repositories/**`, `src/server/services/search.ts` |
| cv / patch | `src/cv/**` |
| ai | `src/server/ai/**`, `src/server/services/ai.ts`, `src/features/chat/**` |
| pdf | `src/pdf/**`, `src/server/pdf/**`, `src/routes/api/cvs.$cvId.pdf.ts` |
| UI | `src/routes/**`, `src/components/**`, `src/features/**` |
| deps | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc` |
| config / env | `src/server/env.ts`, `.env.example`, `vite.config.*`, `tsconfig*`, `eslint.config.*`, `.gitignore` |

## 2. Per-category checks

Run from the repo root (`rg`, or `git grep -nE`). A hit is a candidate: read the code before calling it a finding.

```sh
rg -n 'dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write' src
rg -n 'sql\.raw|\.run\(`|\.prepare\(`|\$\{[^}]+\}.*(SELECT|INSERT|UPDATE|DELETE|MATCH)' src
rg -n '\beval\(|new Function\(|setTimeout\(["'\'']|console\.' src scripts
rg -n '\bfetch\(|axios|node:https?|XMLHttpRequest|WebSocket' src | rg -v 'src/server/ai/providers/anthropic.ts'
rg -n 'process\.env|import\.meta\.env' src | rg -v 'src/server/env.ts'
rg -n -i '(secret|api[_-]?key|password|token)\s*[:=]\s*["'\''][^"'\'']{8,}|sk-ant-|PRIVATE KEY' src scripts tests
rg -nU 'createServerFn\([^)]*\)\s*\.(validator|handler)' src   # fn with no auth middleware
rg -L 'validator\(' src/server/functions      # files with no validator
rg -L '\bcan\(' src/server/functions src/routes/api # files with no authz call
rg -n 'catch\s*(\([^)]*\))?\s*\{\s*\}' src          # empty catch
rg -n '(req|request)\.url|searchParams\.get' src/routes/api  # raw query reads (must go via Zod)
```

- **server-fn / route:** `.middleware([authMiddleware])` and `.validator(<Zod>)` on every
  `createServerFn`. The handler calls `can(actor, action, resource)` before any service work.
  A denial on a resource the user may not know exists returns 404, not 403. Returns a DTO,
  never a DB row. GET functions have no side effects except audit. Server routes check the
  session, run `can()`, parse the query with Zod and set `Cache-Control: no-store`.
- **middleware:** security headers match §9.2 exactly (nonce CSP, no `unsafe-inline` or
  `unsafe-eval` in the prod build). `createCsrfMiddleware()` covers all non-GET functions and
  routes. `X-Powered-By` is off. The error mapper leaks no stack, SQL or internal message.
  The logger redaction list still covers `password, token, cookie, authorization, email, phone, data`.
- **authz:** `can()` stays pure and default-deny. Every new action has rows for all 3 roles
  in the table-driven test. Experts are limited to `user.personId`.
- **db:** only Drizzle query builders or `sql` template tags with bound values. FTS `MATCH`
  goes only through the term builder (≤ 10 terms, ≤ 64 chars, quotes doubled). Expert scoping
  sits in the `WHERE`. Multi-step writes run in one transaction. Append-only triggers on
  `cv_revision` and `audit_event` are intact. Migrations are reviewed SQL and change no
  pragmas (`foreign_keys`, `secure_delete`).
- **cv / patch:** size limits (5,000, 300, 200 items, 512 KB) stay in place. The patch engine
  rejects `__proto__`/`prototype`/`constructor`, a misused `-`, and paths outside the allowlist.
  `/meta/**`, `/$schema` and the name and contact paths stay denied. No mutation.
- **pdf:** a new context per render with `javaScriptEnabled: false`, `offline: true` and
  `route('**/*')` aborting everything except `data:`. The HTML comes only from
  `renderToStaticMarkup`. The semaphore, 15 s timeout and `finally` close are all there.
  The filename is ASCII-folded and RFC 6266 encoded. The `cv.json` attachment drops
  `x-conversionNotes`, and drops contact details unless `contact=1`.
- **UI:** no raw HTML. The preview is `<iframe sandbox srcdoc>` without `allow-scripts`.
  Hiding UI is not access control. No CV data in `localStorage` or in URLs beyond ids and
  search params.
- **config / env:** every new variable is added to `env.ts` (Zod, no default for secrets) and
  `.env.example` (placeholder only). `.env*` except `.env.example` is gitignored. Lint bans from
  §12 are not weakened. Look for new `eslint-disable` lines: `rg -n 'eslint-disable' src`.
- **Human-only files:** any change to `sbxenv.yaml` or `kits/**` is **critical**: revert, propose it in the summary.

## 3. OWASP Top 10:2025 checklist

Answer each item pass, fail or n/a for the scope. Any fail becomes a finding.

| Id | Pass when |
|---|---|
| A01 Broken Access Control (incl. SSRF) | Every new function or route checks authn plus `can()` server-side. Queries are role-scoped. 404 for unseen resources. There is an E2E or integration test that an expert can't read or export another person's CV. There are no user-supplied URL fetches and Chromium stays offline |
| A02 Security Misconfiguration | Headers and CSP unchanged or stricter. The dev relaxation is gated on `import.meta.env.DEV` and tested. Sign-up stays disabled. Errors are generic. The DB file is `0600` in `./data/` |
| A03 Software Supply Chain Failures | See §6. No runtime CDN, remote font or script tag |
| A04 Cryptographic Failures | No hand-rolled crypto, hashing or token generation (Better Auth / `node:crypto` only). `BETTER_AUTH_SECRET` ≥ 32 bytes and never logged. Session cookie flags are unchanged |
| A05 Injection | No `sql.raw` or string-built SQL/FTS. No raw HTML. Zod on every input. Patch paths are allowlisted. Header values and filenames are sanitized |
| A06 Insecure Design | Size and rate limits on new inputs. Humans stay in the loop for AI. Optimistic concurrency (409) is kept. History stays append-only |
| A07 Authentication Failures | Password policy (12+ chars, block list) kept. Login rate limit of 5 per 15 min per email + IP. The error is always "Invalid email or password". Logout and disable revoke sessions. Idle 8 h / absolute 12 h |
| A08 Software or Data Integrity Failures | `dataSha256` written for each revision. Append-only triggers kept. Only JSON parsed through Zod is deserialized. Lockfile integrity kept |
| A09 Security Logging and Alerting Failures | New security-relevant actions, including denials, write `audit_event` with `requestId`. `meta` never holds CV content. Search terms are hashed. The logger is used, not `console` |
| A10 Mishandling of Exceptional Conditions | `Result` for expected failures. No empty or swallowing `catch`. Authz and validation errors fail closed. Timeouts on Chromium (15 s), the LLM (60 s) and the DB (busy 5 s). Transactions roll back |

## 4. LLM checks (OWASP LLM Top 10)

- **LLM01 prompt injection:** the model output is only a Zod-parsed `{reply, operations}`.
  CV and user text sit in delimited user-turn blocks marked as data. The system prompt is
  static and has a snapshot test.
- **LLM02 sensitive disclosure:** `minimize()` strips email, phone, profiles, location, url and
  `x-conversionNotes`, and reduces the name to first name. Tags are never sent. There is a unit
  test for each stripped field.
- **LLM05 output handling:** operations go through `validatePatch` (allowlist), then
  `applyPatch`, then `CvDocument.safeParse`. `reply` is rendered as text, never as HTML or
  Markdown-to-HTML.
- **LLM06 excessive agency:** there are no tools with side effects. The model can't save.
  Saving takes an explicit user click and records `source: ai`.
- **LLM10 unbounded consumption:** rate limit of 20 requests per 10 min per user, `max_tokens` 16000,
  a 60 s timeout, 2 retries, token counts stored. `stop_reason` (`refusal`, `max_tokens`) is
  checked before reading output.
- **Gate:** `anthropic` is never the default; only `AI_PROVIDER` + `ANTHROPIC_API_KEY` in `.env.local`
  after human DPA approval (§9.3) enable it. Tests and E2E use `fake`.

## 5. Personal-data checks

- Prompts, model output, CV fields, emails and phone numbers never reach logs, `audit_event.meta`,
  error messages, thrown `Error` text or HTTP status text.
- No CV values in URLs or query strings (ids only). `Referrer-Policy: no-referrer` kept.
- No new network egress except the Anthropic provider (see the `fetch(` grep). No telemetry,
  analytics, CDN or error-reporting SDKs.
- Tests use `buildCv()` factories. Committed snapshots, fixtures, screenshots, traces and
  `test-results/` hold no real sample-data CVs: `git diff main...HEAD --stat -- '*.snap' tests/`.
  Playwright traces and reports are gitignored.
- `erasePerson` still covers every new table that holds person data. A new column or table
  without erasure coverage is a **high** finding.
- Exports still default to no contact details.

## 6. Dependency checks

- `pnpm audit --audit-level=high` exits 0. Dev-only tools go in `devDependencies`.
- Every new runtime dependency is justified in spec §15 (or §4); otherwise it is a **high** finding.
- Versions are exact (no `^` or `~`): `rg -n '"[\^~][0-9]' package.json`.
- `pnpm-lock.yaml` is committed and in sync: `pnpm install --frozen-lockfile --offline`.
- `minimumReleaseAge: 1440` kept. `onlyBuiltDependencies` is still just `better-sqlite3`,
  `esbuild` and `playwright`. Any addition needs a written reason.
- No new `postinstall` scripts; no git, tarball or URL dependencies.

## 7. Required security tests for the change

Check that the diff adds or keeps tests that fail without the control:

- **401:** an unauthenticated call to each new server function or route.
- **404:** an expert calling with another person's `cvId` or `personId` (not 403).
- **400:** oversized, wrong-typed and extra-field input rejected by Zod.
- **CSRF:** a cross-site POST (`Sec-Fetch-Site: cross-site` or a bad `Origin`) is rejected.
- **429:** the rate limit is hit for login, AI or export when touched.
- **Adversarial:** FTS metacharacters (`"`, `*`, `NEAR`, `OR`, `-`, `:`, `^`), patch paths
  (`__proto__`, `/meta/personId`, `/basics/email`), prompt-injection text in a CV field
  (fake provider), and `<script>`/`<img onerror>` in CV text rendered in the UI, preview and PDF.
- **authz matrix:** new actions are in the table-driven `can()` test. `pnpm verify` is green.

## 8. Output

Report findings in this table, highest severity first, then the A01–A10 pass/fail list:
| # | Severity | File:line | OWASP id | Finding | Fix |
|---|---|---|---|---|---|
| 1 | high | `src/server/functions/cv.ts:42` | A01 | `archiveCv` skips `can()` | Call `can(actor,'cv.archive',cv)`; return 404 on deny; add an expert test |

- **Severity:** critical = exploitable data exposure, auth bypass, RCE, a committed secret, or
  an edit to a human-only file. High = a missing authz, validation, CSRF or minimization
  control, or an unjustified dependency. Medium = defense in depth missing (a header, limit,
  audit event or test). Low = hardening or hygiene.
- **Critical and high block the commit or PR.** Fix, re-run this review and `pnpm verify`, then
  commit. Medium: fix or a written follow-up in the PR. Low: optional. No findings: say so, list checks run.

## Incident path (a real vulnerability in committed or shipped code)

1. **Assess:** what data and which roles, since which commit (`git log -S`), whether it is exploitable locally.
2. **Contain:** disable the feature or route, set `AI_PROVIDER=fake`, revoke sessions,
   and rotate `BETTER_AUTH_SECRET` or the API key if exposed. A leaked secret is rotated,
   not just removed from git.
3. **Fix:** a root-cause fix on a `fix/` branch, with a regression test that failed first.
4. **Verify:** this review plus `pnpm verify` plus the relevant E2E tests.
5. **Document:** what happened, the impact and the fix, in the PR and `.ai-notes.md` Known Issues
   (no personal data).
6. **Notify:** tell the human owner right away. Personal-data exposure may be a GDPR
   breach (72 h notification), and that decision belongs to Kipinä.
