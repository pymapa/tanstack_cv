# Agent rules

See `intent.md` for what we are building and why, and `spec.md` for how. When they disagree,
`intent.md` wins: fix `spec.md` and say so in your summary.

## Non-negotiable

- Work on a feature branch, never on main.
- Treat all CV data as real personal data: never send it to external services, paste it
  into URLs, or add network calls that upload it.
  - The **only** exception is the LLM provider module
    (`src/lib/ai/claude.ts`). It stays off unless a human sets
    `AI_PROVIDER=anthropic` (spec §9.3). Agents must never enable it, add a key, or add
    another provider or outbound call. Tests and dev use the `fake` provider.
  - Never put CV content in logs, error messages, URLs, commit messages, or test snapshots.
    Build test data with the `buildCv()` factories and invented names.
- Do not edit `sbxenv.yaml` or anything under `kits/`. They configure the agent sandbox and
  must be changed by a human. Propose such changes in your summary instead.
- Never read, create, or commit `.env*` files except `.env.example`, which holds
  placeholders only.
- Ask a human before changing: DB schema or migrations, auth/session config, the authz
  policy matrix (spec §2), security headers/CSP, CI, or adding a runtime dependency.

## How we work

- **TDD is mandatory.** Write a failing test, then the minimal code, then refactor. No
  production code without a test that failed first. See `.claude/skills/tdd/SKILL.md`.
- Before you say something is done, run `pnpm verify` (typecheck, lint, tests, audit, secret
  scan, build). Run `pnpm test:e2e` when you changed user flows. Report failures honestly.
- Build in the order of the spec's milestones (§3, M0–M6). Keep each milestone's commits
  small and green.
- Every server function follows the secure pattern: auth middleware → Zod
  `validator` → `can()` → service → DTO (`.claude/skills/secure-server-fn`).
- Keep the layering `routes → server/functions → server/services → server/repositories → db`.
  Put no business logic in routes or server functions.
- Modern TypeScript: strict, no `any`, immutable data, `Result` types for expected
  failures, small pure functions with injected dependencies.
- Pin new dependencies to exact versions, check that they're the latest stable, and write
  down why each one is needed in spec §15.
- Commits: `feat:` / `fix:` / `chore:` / `test:` / `docs:` / `refactor:`.
- If you designed something but didn't build it, add it to "Considered but not built" in
  `intent.md` with one line on the intended approach. That list is part of the deliverable.
- Update `.ai-notes.md` (40 lines max: WIP, decisions, known issues) after sessions with
  meaningful changes.

## Skills (task playbooks)

Read the matching playbook before starting a task. They live in `.claude/skills/`. Claude
Code loads them automatically; other agents should open the `SKILL.md` directly.

| Skill | Use when |
|---|---|
| `tdd` | Any feature, bug fix, or behavior change |
| `kipina-brand` | Any UI or PDF look: colors, type, logo, layout, copy |
| `secure-server-fn` | Adding or changing server functions, server routes, middleware, or authz |
| `new-route` | Adding or changing pages, layouts, loaders, or URL search params |
| `cv-schema` | Touching the CV data shape, revisions, import, or adding a CV field |
| `cv-search` | Search, facets, the FTS index, or ranking |
| `pdf-template` | The PDF look, template components, render pipeline, or export options |
| `ai-cv-edit` | The AI chat, LLM provider, prompts, or patch engine |
| `db-migration` | Schema, migrations, indexes, or triggers |
| `owasp-review` | Before every commit or PR, and after security-relevant changes |
| `feature-flow` | Taking a feature end to end: worktree, build, review, PR, local-test handover |
