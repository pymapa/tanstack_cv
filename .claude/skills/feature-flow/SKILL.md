---
name: feature-flow
description: Take a feature from request to a pull request that is ready for handover. Builds the change in a git worktree on a feature branch, reviews it once with /code-review, commits, pushes, opens a draft PR, then hands the worktree over for local testing. The flow ends at the handover; it does not ask whether the feature works. Use when the user asks to build, add or implement a feature end to end.
argument-hint: <feature description>
---

# Feature flow

Feature to build: $ARGUMENTS

If the feature description is empty or too vague to implement, ask the user what to build
before starting. Follow `AGENTS.md` and `CLAUDE.md` at every step, especially the rules on
CV data and on files that agents must not edit.

Run the steps in order. Do not skip a step. If one fails and you cannot fix it, stop and
report where you stopped and why.

## 1. Worktree and branch

All work happens in a git worktree, so the user's own checkout is never touched: no branch
switch, no stray build output, no regenerated files.

1. Fetch the latest `main`: `git fetch origin main`. If `origin` cannot be reached (for
   example, it uses an SSH host alias that only exists on the user's machine), fetch from the
   repository's HTTPS URL into `refs/remotes/origin/main` instead.
2. Pick a branch name: `feat/<short-kebab-name>`, or `fix/` or `chore/` when that fits
   better. Never work on `main`.
3. Create the worktree from the fresh `main` and move into it:
   `git worktree add --no-track -b <branch> .worktrees/<short-kebab-name> origin/main`.
   `.worktrees/` is gitignored. Run every later command from inside the worktree.
4. Install dependencies in the worktree: `pnpm install --frozen-lockfile`.

## 2. Implement

1. Read `intent.md`, `spec.md` and the code the feature touches. Keep to what was asked.
2. Implement the feature test-first (`tdd` skill), matching the style of the code around it.
3. Run the project's checks and fix what the change broke: `pnpm verify`, plus
   `pnpm test:e2e` when the change touches a user flow. Errors that were there before the
   change are not in scope, but mention them in the PR.
4. If you start a dev server to try the change, never use port 3000; it is the user's. Use
   3001 or higher with `--strictPort`, and stop the server when you are done.
5. If part of the feature was designed but not built, add it to **Considered but not built**
   in `intent.md` with a short note on the intended approach.

## 3. Review

One review pass, on the full diff against `main`, before anything is committed:

1. Invoke the `code-review` skill on the worktree diff, and the `owasp-review` skill when the
   change touches anything that skill lists.
2. Fix every finding you agree with. For each one you reject, note why; the reasons go into
   the PR description.
3. Re-run the checks from step 2.

## 4. Commit and push

1. Stage only the files that belong to this feature. Never stage `.env` files or secrets.
2. Commit with a message in the repository's style (`feat: Add ...`, `fix: ...`, `chore: ...`).
   Split unrelated changes into separate commits.
3. Push the branch: `git push -u origin <branch>`, or to the HTTPS URL if `origin` cannot be
   reached. If the push fails with an authentication or permission error, stop and tell the
   user what failed. Do not try other credentials.

## 5. Open a draft PR

Create the PR as a **draft**: `gh pr create --draft --base main`. Pass `--repo <owner>/<repo>`
if `gh` cannot infer the repository from `origin`.

The description contains:

- **What and why**: the feature, and which requirement in `intent.md` it serves.
- **How to test**: the steps a reviewer follows to see it work.
- **Review notes**: review findings that were not fixed, and why.
- **Not built**: anything that was added to "Considered but not built".
- **Needs a human**: changes an agent must not make, such as network allowlist entries or
  sandbox configuration.

## 6. Hand over

The flow is done when the worktree is ready for handover: checks pass, the branch is pushed
and the draft PR is open. Do not ask whether the feature works and do not wait for the user.
Testing it and marking the PR ready (`gh pr ready <number>`) is the user's call.

Leave the worktree in place so the user can test in it. Report to the user:

- the draft PR link, the branch name and the worktree path (`.worktrees/<short-kebab-name>`);
- what to run there (`pnpm dev` on a free port, any env or data setup) and what to check,
  taken from the PR's "How to test";
- what was built, the review findings and how each was handled;
- anything that needs a human.

If the user later reports problems or asks for changes, fix them in the same worktree, re-run
the checks from step 2, commit, push, and report again. When they are done with it, they can
remove the worktree with `git worktree remove .worktrees/<short-kebab-name>`; the branch stays
on the remote.
