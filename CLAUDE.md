@AGENTS.md

## Claude Code specifics

- Project skills are in `.claude/skills/` (listed in AGENTS.md). Invoke the matching skill
  before starting a task. Run `owasp-review` before every commit.
- `.claude/settings.json` denies edits to `sbxenv.yaml` and `kits/**` and reads of `.env*`.
  Don't try to work around it.
- For the Claude API integration (`src/server/ai/providers/anthropic.ts`), load the
  `claude-api` skill before writing code. Never guess SDK call shapes.
- Prefer the spec's commands (`pnpm verify`, `pnpm test`, `pnpm test:e2e`) over ad-hoc scripts.
