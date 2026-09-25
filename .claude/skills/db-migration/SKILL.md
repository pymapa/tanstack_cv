---
name: db-migration
description: Change the Kipinä CV bank database schema safely (SQLite + better-sqlite3 + Drizzle ORM/drizzle-kit). Use when touching src/db/schema.ts, src/db/migrations/, indexes, triggers, pragmas, the cv_search FTS5 table, or the GDPR erase path.
---

# DB migration (SQLite + Drizzle)

This project uses **SQLite via better-sqlite3 13 + Drizzle ORM 0.45 + drizzle-kit 0.31**, not
Oracle/Flyway (spec §15 D1). Ignore the team's Oracle/Flyway defaults here. The team rules
still apply: no manual schema changes, and **a human approves schema changes**.

## 0. Approval gate (mandatory)
Before you edit `src/db/schema.ts` or add a migration, describe the change to the human and
**wait for approval**. Include the tables/columns/indexes/triggers affected, whether it needs
a table rebuild, the data impact (backfill, loss, erase path), and the rollback plan. Don't
proceed on "probably fine".

## 1. Where things live
- `src/db/schema.ts`: Drizzle tables (source of truth for regular tables/indexes).
- `src/db/migrations/`: drizzle-kit SQL, committed and reviewed. `meta/_journal.json` and
  snapshots are generated; never hand-edit them.
- `src/db/client.ts`: opens the connection and sets pragmas.
- `drizzle.config.ts` (shape, unverified against 0.31 exact typings):
  ```ts
  import { defineConfig } from 'drizzle-kit'
  export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dbCredentials: { url: process.env.DATABASE_PATH ?? './data/cvbank.sqlite' },
    strict: true,
  })
  ```

## 2. Workflow
1. Get approval (§0). Work on a feature branch.
2. Write a failing integration test first (TDD skill).
3. Edit `src/db/schema.ts`.
4. `pnpm db:generate` (= `drizzle-kit generate`). **Read the generated SQL line by line.**
   Look for unintended `DROP`, a table rebuild (`__new_<table>` + `INSERT INTO ... SELECT`),
   lost triggers, and missing FK indexes.
5. For things drizzle-kit can't express, add a custom migration:
   `pnpm drizzle-kit generate --custom --name=<what>` (creates an empty SQL file you fill in).
6. Back up the dev DB (§6), then run `pnpm db:migrate` on a **copy**:
   `DATABASE_PATH=./data/cvbank.copy.sqlite pnpm db:migrate`. Then check `PRAGMA integrity_check;`
   and `PRAGMA foreign_key_check;`.
7. The integration test migrates a fresh in-memory DB from zero with
   `migrate(db, { migrationsFolder: 'src/db/migrations' })` from
   `drizzle-orm/better-sqlite3/migrator`, then asserts the new behaviour (triggers abort,
   FTS matches, unique index rejects duplicates).
8. `pnpm verify` green before committing. Commit the schema, the SQL and meta together.

## 3. Hard rules
- **Never edit a migration that has been applied** anywhere (dev DB included). Add a new one.
- **Never change the schema manually** (sqlite3 shell, `drizzle-kit push`, ad-hoc DDL in code).
- Do not declare `cv_search` in `schema.ts` (drizzle-kit would try to manage it as a normal
  table). Query it through the `sql` template tag.
- Parameterized queries only: Drizzle builders or `` sql`... ${value}` ``. `sql.raw` is banned
  by lint and never takes user input. FTS `MATCH` input goes through the FTS query builder (§7.2).
- Ids are **UUIDv7** text (app-generated through the injected `idGen`), except `person.legacyId`.
- Timestamps are **ISO-8601 UTC text** (`2026-09-25T10:00:00.000Z`) from the injected `clock`.
- Multi-step writes run in **one `db.transaction(...)`** (better-sqlite3 transactions are
  synchronous; don't `await` inside them).
- **Every FK column gets an explicit index** (SQLite doesn't create one), with a comment saying
  which query or cascade needs it.

## 4. SQLite ALTER TABLE limits and the rebuild pattern
SQLite supports `ADD COLUMN` (no `PRIMARY KEY`/`UNIQUE`; `NOT NULL` needs a default),
`RENAME COLUMN`, `RENAME TO` and `DROP COLUMN` (fails if the column is indexed, in a FK,
PK/UNIQUE, or used by a trigger/view). Anything else (change type, nullability, FK, CHECK)
needs a rebuild, which drizzle-kit generates for you. Review it against this pattern:
```sql
PRAGMA foreign_keys=OFF;  -- has no effect inside a transaction; drizzle-kit emits it outside
CREATE TABLE __new_cv (...);
INSERT INTO __new_cv (cols...) SELECT cols... FROM cv;
DROP TABLE cv;
ALTER TABLE __new_cv RENAME TO cv;
-- recreate indexes AND triggers on cv (DROP TABLE removed them)
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
```
**Rebuilding `cv_revision` or `audit_event` drops their append-only triggers.** The same change
must recreate them in a custom migration, and a test must prove UPDATE/DELETE still abort.

## 5. Custom SQL (what drizzle-kit can't express)
Separate statements with `--> statement-breakpoint`. Sample `src/db/migrations/00NN_append_only_and_fts.sql`:
```sql
CREATE TRIGGER cv_revision_no_update BEFORE UPDATE ON cv_revision
BEGIN SELECT RAISE(ABORT, 'cv_revision is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER cv_revision_no_delete BEFORE DELETE ON cv_revision
BEGIN SELECT RAISE(ABORT, 'cv_revision is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_update BEFORE UPDATE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_delete BEFORE DELETE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit_event is append-only'); END;
--> statement-breakpoint
CREATE VIRTUAL TABLE cv_search USING fts5(
  cv_id UNINDEXED, name, label, variant, keywords, skills, clients, industries, roles, body,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- One active CV per (person, variant). Drizzle can model this with
-- uniqueIndex(...).on(...).where(sql`archived_at IS NULL`); if the generated SQL lacks the
-- WHERE clause (unverified for 0.31), put it here instead.
CREATE UNIQUE INDEX cv_person_variant_active_uq ON cv (person_id, variant) WHERE archived_at IS NULL;
```
Keep the FTS column order in sync with the `bm25(...)` weights in `search.ts` (spec §7.2).

## 6. Backups before migrating
Stop the app, or use the online backup API. Never copy a live WAL database file by itself.
- `sqlite3 data/cvbank.sqlite ".backup 'data/backup-<YYYYMMDD-HHMM>.sqlite'"` (safe while running), or
- stop the app and copy `cvbank.sqlite` together with any `-wal`/`-shm` files.
Backups hold personal data: keep them in `./data/` (gitignored), mode `0600`, and never upload them.

## 7. Connection pragmas (`src/db/client.ts`, per connection, not in migrations)
```ts
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000'); db.pragma('secure_delete = ON')
```
Also create the file with mode `0600`. Tests assert these pragmas on a fresh connection.

## 8. GDPR erase (`person.erase`), the only trigger bypass
SQLite can't disable triggers, but DDL is transactional. In **one** `db.transaction`:
`DROP TRIGGER cv_revision_no_delete` → delete the person's revisions, AI messages, cv_tag,
cv_facet, cv_search rows, CVs and the person → `DROP TRIGGER audit_event_no_update` →
pseudonymize that person's audit rows (keep `targetId`, strip names) → **recreate both triggers
with the exact migration SQL** (share one constant) → insert the audit event for the erase.
Any error rolls it all back, triggers included. Test: after the erase, the triggers exist and
still abort, and no row mentions the person's name. `secure_delete=ON` overwrites the freed pages.

## 9. Checklist for the summary to the human
- [ ] Approval obtained; change described
- [ ] Generated SQL reviewed; rebuilds recreate indexes and triggers
- [ ] FK indexes added and commented
- [ ] Backup taken; migrated a copy; `integrity_check`/`foreign_key_check` ok
- [ ] From-zero in-memory migration test passes; `pnpm verify` green
- [ ] No applied migration edited; no `sql.raw` with input
