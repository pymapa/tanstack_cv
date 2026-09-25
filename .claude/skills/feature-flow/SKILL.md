---
name: feature-flow
description: Take a feature from request to reviewed pull request. Implements the change on a feature branch, reviews it with /code-review, cleans it up with /simplify, commits, pushes, opens a draft PR, reviews the PR, and marks it ready only after that review is done. Use when the user asks to build, add or implement a feature end to end.
argument-hint: <feature description>
---

# Feature flow

Feature to build: $ARGUMENTS

If the feature description is empty or too vague to implement, ask the user what to build
before starting. Follow `AGENTS.md` and `CLAUDE.md` at every step, especially the rules on
CV data and on files that agents must not edit.

Run the steps in order. Do not skip a step. If one fails and you cannot fix it, stop and
report where you stopped and why.

## 1. Branch

1. Check that the working tree is clean (`git status`). If it is not, ask the user what to do
   with the changes. Do not discard them.
2. Bring `main` up to date with the remote, then create a branch from it:
   `feat/<short-kebab-name>`, or `fix/` or `chore/` when that fits better. Never work on `main`.

## 2. Implement

1. Read `intent.md` and the code the feature touches. Keep to what was asked.
2. Implement the feature, matching the style of the code around it.
3. Run the project's checks and fix what the change broke: `pnpm verify` (typecheck, ESLint,
   Prettier, unit + integration tests, `pnpm audit`), plus `pnpm test:e2e` when the change
   touches a user flow. Errors that were there before the change are not in scope, but mention
   them in the PR.
4. If part of the feature was designed but not built, add it to **Considered but not built**
   in `intent.md` with a short note on the intended approach.

## 3. Review the change

1. Invoke the `code-review` skill on the working-tree diff.
2. Fix every finding you agree with. For each one you reject, note why; the reasons go into
   the PR description.
3. Re-run the checks from step 2.

## 4. Simplify

1. Invoke the `simplify` skill on the changes.
2. Re-run the checks from step 2.

## 5. Commit and push

1. Stage only the files that belong to this feature. Never stage `.env` files or secrets.
2. Commit with a message in the repository's style (`feat: Add ...`, `fix: ...`, `chore: ...`).
   Split unrelated changes into separate commits.
3. Push the branch: `git push -u origin <branch>`. If `origin` cannot be reached (for example,
   it uses an SSH host alias that only exists on the user's machine), push to the repository's
   HTTPS URL instead. If the push fails with an authentication or permission error, stop and
   tell the user what failed. Do not try other credentials.

## 6. Open a draft PR

Create the PR as a **draft**: `gh pr create --draft --base main`. Pass `--repo <owner>/<repo>`
if `gh` cannot infer the repository from `origin`.

The description contains:

- **What and why**: the feature, and which requirement in `intent.md` it serves.
- **How to test**: the steps a reviewer follows to see it work.
- **Review notes**: review findings that were not fixed, and why.
- **Not built**: anything that was added to "Considered but not built".
- **Needs a human**: changes an agent must not make, such as network allowlist entries or
  sandbox configuration.

## 7. Review the PR

1. Invoke the `code-review` skill on the PR number with `--comment`, so the findings are
   posted to the PR.
2. Fix the findings you agree with, re-run the checks, commit and push. Reply on the PR to
   findings you reject, with the reason.
3. Repeat until no new findings you agree with remain.

## 8. Mark ready

Only after step 7 is finished, mark the PR ready for review: `gh pr ready <number>`.

Report to the user: the PR link, what was built, the review findings and how each was
handled, and anything that needs a human.
