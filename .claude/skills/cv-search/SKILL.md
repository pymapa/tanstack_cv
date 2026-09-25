---
name: cv-search
description: How CV search works (SQLite FTS5 + cv_facet) and how to change it safely. Trigger when changing search, facets, the FTS index, ranking, snippets, search URL params, or the search UI.
---

# CV search

Source of truth: `spec.md` §6.2 (`cv_facet`, `cv_search`), §7.2, §9 A05/A01, §14. Files:
`src/cv/search-text.ts` (pure CV → text + facets), `src/server/services/search.ts` (SQL),
`src/features/search/` (UI), `src/routes/_authed/index.tsx` (URL params). TDD: test first.

## 1. FTS5 table (hand-written custom migration: `pnpm drizzle-kit generate --custom`)

```sql
CREATE VIRTUAL TABLE cv_search USING fts5(
  cv_id UNINDEXED, name, label, variant, keywords, skills, clients, industries, roles, body,
  tokenize = 'unicode61 remove_diacritics 2'   -- "Makinen" matches "Mäkinen"
);
```
- Use a **regular** (content-storing) table, not contentless (`content=''`): snippet() needs the
  text, and delete-by-`cv_id` just works. Size is trivial at 2,000 CVs.
- On every revision save, **in the same transaction** as revision + pointer + audit:
  `DELETE FROM cv_search WHERE cv_id = ?` then `INSERT` one row; same delete+insert for
  `cv_facet`. Archive/erase must delete the rows too. Never update the index outside the tx.
- Index `cv_facet(kind, value_norm, cv_id)`. Drizzle can't model FTS5: query it via `sql```.

## 2. `src/cv/search-text.ts` (pure, readonly, ≥ 90% coverage)

`toSearchDoc(cv: CvDocument, meta: { variant; title }) → { columns, facets }`

| Column | CV fields |
|---|---|
| `name` | `basics.name` |
| `label` | `basics.label`, `basics.x-tagline`, `basics.x-experienceSummary` |
| `variant` | `cv.variant`, `cv.title`, `meta.variant` |
| `keywords` | `basics.x-keywords[]`, `basics.x-strengths[].title`, `basics.x-keySkills[].title` |
| `skills` | `skills[].name`, `skills[].keywords[]`, `projects[].keywords[]`, `certificates[].name` |
| `clients` | `projects[].entity` |
| `industries` | `basics.x-industries[]`, `projects[].x-industry` |
| `roles` | `basics.x-keyRoles[].title`, `projects[].roles[]`, `work[].position` |
| `body` | `basics.summary`, strengths/keySkills/keyRoles descriptions, `projects[].name/description`, `work[].name/summary`, education, `x-testimonials[].quote` |

**Never index** `basics.email/phone/url/location/profiles`, `meta.personId`, `meta.x-conversionNotes`
(test this). Strip the snippet sentinels `\u0001`/`\u0002` from all text before indexing.

Facets (`kind` → source): `skill` ← `skills[].keywords`, `projects[].keywords` · `skillCategory` ←
`skills[].name` · `industry` ← `x-industries`, `projects[].x-industry` · `role` ← `x-keyRoles[].title`,
`projects[].roles` · `client` ← `projects[].entity` · `keyword` ← `x-keywords` · `variant` ← `cv.variant`.
`valueNorm = normalizeFacet(v)`: NFKD → strip `\p{M}` → lowercase → trim → collapse spaces. Dedupe per
`(kind, valueNorm)`, keep the first original as display `value`. Tags (`cv_tag`), employment type
(`person`) and "Needs review" (`cv.reviewedAt`) are **not** in `cv_facet`; filter them by join.

## 3. Safe MATCH builder (A05) — `buildMatchQuery`

Raw input never reaches `MATCH`. Every term becomes a quoted FTS5 string + prefix, so operators
(`OR`, `NEAR`, `-`, `:`, `^`, `(`) are plain text. The result is **bound**, never interpolated.

```ts
const MAX_TERMS = 10, MAX_TERM_LEN = 64
const HAS_TOKEN = /[\p{L}\p{N}]/u   // unicode61 drops pure punctuation → empty phrase

export function buildMatchQuery(input: string): string | null {
  const terms = input.normalize('NFC').split(/\s+/u)
    .map((t) => t.slice(0, MAX_TERM_LEN))
    .filter((t) => HAS_TOKEN.test(t))
    .slice(0, MAX_TERMS)
  if (terms.length === 0) return null            // caller: facet-only / browse query
  return terms.map((t) => `"${t.replaceAll('"', '""')}"*`).join(' ')   // implicit AND
}
```
Cap `q` at 200 chars in Zod before this. Slice by code point if you touch it (`Array.from`).

```ts
describe('buildMatchQuery', () => {
  it.each([
    ['scrum', '"scrum"*'],
    ['say "hi', '"say"* """hi"*'],
    ['a OR b', '"a"* "OR"* "b"*'],
    ['NEAR(a b)', '"NEAR(a"* "b)"*'],
    ['name:Smith', '"name:Smith"*'],
    ['-azure ^java', '"-azure"* "^java"*'],
    ['Mäkinen', '"Mäkinen"*'],
  ])('should quote %s as literal terms when input has FTS syntax', (q, want) => {
    expect(buildMatchQuery(q)).toBe(want)
  })
  it.each(['', '   ', '"', '*', '-', '()', ':'])('should return null when %j has no tokens', (q) => {
    expect(buildMatchQuery(q)).toBeNull()
  })
  it('should cap at 10 terms of 64 chars when input is huge', () => {
    const out = buildMatchQuery(`${'x'.repeat(500)} `.repeat(50)) ?? ''
    expect(out.split(' ')).toHaveLength(10)
    expect(out.split(' ')[0]).toHaveLength(64 + 3)
  })
})
```
Integration test (real SQLite): run **every** adversarial input (`"`, `*`, `NEAR`, `OR`, `AND`,
`NOT`, `-`, `:`, `^`, `name:x`, `(`, `)`, empty, whitespace, 10 kB, `ä ö å`) through `searchCvs`
and assert no throw + sane results; `"Makinen"` finds `"Mäkinen"`; `name:` does not filter columns.

## 4. Ranking and snippets

```sql
SELECT cv_id, bm25(cv_search, 0, 10, 6, 4, 5, 5, 4, 3, 3, 1) AS rank,
       snippet(cv_search, -1, char(1), char(2), '…', 12) AS snip
FROM cv_search WHERE cv_search MATCH :match ORDER BY rank LIMIT 500
```
- bm25 weights go to **every** column in order, including `cv_id UNINDEXED`, so prepend `0`.
  (§7.2's 9-weight list omits it; fix the spec if you touch ranking.) Lower bm25 = better.
- `snippet` column `-1` = best column. Sentinels are control chars, not `<mark>`: the UI splits
  the string on `\u0001`/`\u0002` and renders `<mark>{text}</mark>` as React text. Never use
  `innerHTML` / `dangerouslySetInnerHTML` (lint-banned). Test: a CV containing `<img onerror>`
  renders as literal text.

## 5. Service query (`search.ts`)

- Built with Drizzle `sql``…`` and `sql.join` / `inArray` for lists; `sql.raw` is lint-banned.
- **Facets:** per facet kind with values, AND a clause
  `cv.id IN (SELECT cv_id FROM cv_facet WHERE kind = ? AND value_norm IN (?, …))`
  → OR within a facet, AND across facets. Normalize incoming values with `normalizeFacet`.
- **AuthZ inside SQL (A01):** experts add `person.id = :ownPersonId`; an expert with no
  `personId` gets an empty result, never the unscoped query. Scope is computed from the actor,
  never from input. Archived CVs / persons excluded unless `includeArchived` (and `can()` allows).
- **Grouping:** group CV hits by person; person score = best CV rank; within a person, primary
  CV first, then rank. Paginate **people** (`page`, `limit ≤ 50`). Return the live count
  (people, CVs) and facet counts over the matching set.
- No `q` → skip FTS, order by `person.fullName`. Audit: hashed terms + facet names only.

## 6. URL params (`validateSearch`)

Zod schema on the `/` route: `q: z.string().max(200).catch('')`, each facet key (`skill`,
`skillCategory`, `industry`, `role`, `client`, `keyword`, `variant`, `tag`, `employmentType`)
`z.preprocess(toArray, z.array(z.string().max(100)).max(20)).catch([])`, `needsReview:
z.boolean().optional()`, `page: z.number().int().min(1).catch(1)`. Invalid params degrade, never
throw. Use `.catch`, and the same schema (shared) as the `searchCvs` server-fn input.

## 7. Adding a facet — checklist

1. Add the kind to the `FacetKind` union + DB enum (migration → **human approval**).
2. Extract it in `search-text.ts`; unit test with `buildCv({...})` fixtures (no copied samples).
3. Add it to `searchCvs` input, `validateSearch`, the facet sidebar (label, checkbox, count).
4. If it should be text-searchable, decide its FTS column (a new column = recreate the table +
   new bm25 weight in the same position + snippet test).
5. Run `pnpm search:rebuild`; add a service test for OR-within / AND-across and expert scoping.
6. Axe + keyboard check the sidebar in the search E2E.

## 8. Performance (§14: < 50 ms p95 server, 2,000 CVs)

`tests/integration/search.bench.test.ts`: seeded PRNG + `buildCv` generates 2,000 CVs with
placeholder names (`Person 0001`), realistic skill/industry/client pools; insert via the real
save path in one tx. Warm up 5 queries, then time 50 mixed queries (1–3 terms, prefix, 0–3
facets, expert scope) with `performance.now()`; assert p95 < 50 ms. Log the p95. If slow:
`EXPLAIN QUERY PLAN`, check the `cv_facet` index, lower the FTS `LIMIT`, run `optimize`.

## 9. Rebuild the index

`pnpm search:rebuild` (`scripts/rebuild-search-index.ts`): in one transaction, delete all
`cv_search` + `cv_facet` rows and re-derive them from each non-archived CV's current revision via
`toSearchDoc`, then `INSERT INTO cv_search(cv_search) VALUES('optimize')`. Run it after any change
to `search-text.ts`, columns, tokenizer or normalization, and after `pnpm db:import`.
