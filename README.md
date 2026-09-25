# Kipinä CV bank

What we're building: [intent.md](intent.md). How we build it: [spec.md](spec.md). Rules for coding agents: [AGENTS.md](AGENTS.md).

## Running the app

```sh
pnpm install
pnpm exec playwright install chromium   # used for PDF export and E2E tests
pnpm dev                                # http://localhost:3000 (or: pnpm dev --port 3100)
pnpm verify                             # typecheck, lint, format, unit + integration tests, audit
pnpm test:e2e                           # Playwright E2E + axe (starts its own server on :3200)
```

The app currently reads CVs from `sample_data/` into memory. Edits last until the server
restarts. There's no login yet (spec M2), so keep the dev server on localhost.

## Local database

PostgreSQL 17 runs in Docker (`docker-compose.yml`) and keeps its data in the `cv-db-data`
volume. It listens on `127.0.0.1:5432` only. Nothing uses it yet: the app moves from the
in-memory store to Postgres in spec M1.

```sh
pnpm db:up                  # start Postgres and wait until it is healthy
pnpm db:psql                # open a psql shell in the container
pnpm db:down                # stop it; the volume and its data are kept
docker compose down -v      # stop it and delete the data
```

Server code connects through `src/db/client.ts` (`query`, `withTransaction`), which reads
`DATABASE_URL` (spec §13):

```env
DATABASE_URL=postgres://cvbank:cvbank-local@localhost:5432/cvbank
```

The user, password, database and port can be changed with `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` and `POSTGRES_PORT`, which `docker compose` reads from the shell or from `.env`;
update `DATABASE_URL` to match. Postgres only reads the user, password and database when it
creates the volume, so changing them later also needs `docker compose down -v`, which deletes
the data.

## Running agents in a sandbox

Coding agents run unattended in [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/)
([install `sbx`](https://docs.docker.com/ai/sandboxes/install/)), configured in `sbxenv.yaml`.

```sh
sbx env plan                             # review before first run and after config changes. You can choose "balanced" for the network egress config for this repo
sbx env run                              # Claude Code
sbx env run --env-arg agent=cursor       # Cursor
```

## Connecting your IDE to the sandbox

- [VS Code](https://docs.docker.com/ai/sandboxes/integrations/vscode/)
- [Cursor](https://docs.docker.com/ai/sandboxes/integrations/cursor/)

The agent works in its own git clone. Pull its work with:

```sh
git fetch sandbox-kipina-cv-claude       # or sandbox-kipina-cv-cursor
git diff main..sandbox-kipina-cv-claude/<branch>
```

- Always start with `sbx env run`. A plain `sbx run` mounts this checkout read-write.
- Review changes to `sbxenv.yaml` and `kits/` before merging: they run on your host.
- Keep secrets and real CV data out of this folder. The agent can read all of it.
