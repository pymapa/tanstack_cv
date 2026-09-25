---
name: cv-schema
description: CV document model and persistence for the Kipinä CV bank. Use when touching the CV data shape, anything in src/cv/* (schema.ts, patch.ts, diff.ts, search-text.ts), the Zod CvDocument or sample_data/schema/cv.schema.json, cv/cv_revision persistence (revisions, sha256, optimistic concurrency, primary version), the sample-data import script, or when adding, renaming or removing a CV field.
---

# CV schema and persistence

Source of truth: `spec.md` §6 (data model), §7.3–7.7, and `sample_data/schema/cv.schema.json`.
If this skill and the spec disagree, the spec wins. Fix this file afterwards.

## 1. Document format

- Every CV is **JSON Resume 1.0** (`jsonresume.schema.json`) plus Kipinä **`x-` extensions**
  (`cv.schema.json`, `allOf` of both). Standard fields keep exports usable in other tools.
- Required: `basics.{name,label,summary}`, `skills[].name`, `projects[].{name,entity}`,
  `work[].name`, `certificates[].name`, `meta.{personId,variant,sourceFormat,x-cvYear}`.
- Samples: 36 CVs / 28 people in `sample_data/cvs/pNN-vM.json`. Every sample has `basics`,
  `work`, `skills`, `projects`, `meta`; some have `certificates` and `x-testimonials`. None
  have `education` or `languages` yet, so test those with factory fixtures.

### Extension fields

| Field | Meaning | Where it shows in the PDF (§7.7) |
|---|---|---|
| `basics.x-experienceSummary` | "20+ years of business experience" | Cover/profile page |
| `basics.x-tagline` | Personal motto | Cover page |
| `basics.x-keywords`, `x-industries` | Keywords, industry expertise (string[]) | Cover chips; also search facets |
| `basics.x-strengths` | "In a nutshell" `{title, description?}` | Cover page |
| `basics.x-keyRoles`, `x-keySkills` | Key roles / skills `{title, description?}` | Cover page |
| `basics.x-hobbies` | Generalized hobbies (string) | Not placed in the template yet. Decide before rendering |
| `skills[].x-skillDetails` | Per-tech `{name, years: number\|null, yearsText?, note?}` | Skills page: bars/labels (never color alone) |
| `skills[].level` (standard) | Category-level experience when years are per category | Skills page |
| `projects[].entity` (standard) | Client (name or generic description) | Highlights + project history; `client` facet |
| `projects[].x-employer` | Employer during the project, if not Kipinä | Highlights + project history |
| `projects[].x-industry` | Client industry | Highlights + project history; `industry` facet |
| `projects[].x-duration` | Duration as source text ("2 yr, 9 mo") | Project history, when dates are missing |
| `projects[].x-highlight` | Boolean: include in "Project highlights" | Selects the highlights section |
| `projects[].x-note`, `work[].x-note` | Conversion interpretation | Not rendered |
| `certificates[].x-dateText` | Original non-ISO date ("2017-2018") | Education & certificates, when no ISO date |
| `x-testimonials` | `{quote, author?}` (rewritten) | Cover testimonial quote |
| `meta.personId` | Legacy person id `^p[0-9]{2}$` | Not rendered (app-managed) |
| `meta.variant` | Version purpose (`default`, `PM`, `SM-PO-AI`) | PDF file name; `variant` facet |
| `meta.sourceFormat` | `pptx` \| `pdf` | Not rendered (app-managed) |
| `meta.x-cvYear` | CV year `^[0-9]{4}$` | Not rendered |
| `meta.x-conversionNotes` | Source errors / interpretations (string[]) | Never rendered, never exported, never sent to AI |
| `meta.x-template` | PDF template id (`CV_TEMPLATE_IDS`, list in spec §7.7); missing = `kipina-portrait` | Chooses the page layout; not in the `cv.json` export |
| `meta.language` (new, §6.1) | `"en"` default, `"fi"` [Later] | PDF Language metadata |

**Every object is strict** (`z.strictObject`). An unknown field, standard or `x-`, fails
validation instead of being silently dropped, so nothing is ever lost on import or save. To
support another JSON Resume field (e.g. `volunteer`), add it to the schema on purpose.

## 2. Zod `CvDocument` (`src/cv/schema.ts`)

- Mirrors `cv.schema.json` field for field. It is the single runtime + type source: derive
  types with `z.infer`, expose them as `readonly` (deep) types.
- **Drift test** (`tests/unit/cv/schema.test.ts`): load every `sample_data/cvs/*.json`, and
  assert each one passes **both** Ajv (dev dependency only, loads both JSON Schema files) and
  `CvDocument.safeParse`. Also assert that a document Zod rejects is rejected by Ajv too, for
  a few crafted negatives (unknown key in an `x-` object, bad date, bad `personId`).
- Limits (A06/A10), enforced in Zod:
  - Long text (summary, descriptions, quotes): ≤ 5,000 chars. Titles/names/labels: ≤ 300.
  - Every array ≤ 200 items.
  - Whole document ≤ **512 KB** serialized (`superRefine` on `JSON.stringify(doc).length`
    in bytes, or check at the server boundary before parsing).
- Dates: `startDate`, `endDate`, `date` match `^\d{4}(-\d{2}(-\d{2})?)?$` (`YYYY`, `YYYY-MM`,
  `YYYY-MM-DD`). Missing `endDate` = ongoing. Missing both dates is allowed (source had none).
  Non-ISO originals go in `x-dateText` / `x-duration`, never in a date field.
- `variant` names (§7.3): 1–40 chars, `[A-Za-z0-9 -]`.

## 3. App-managed (read-only) fields

`meta.personId`, `meta.sourceFormat`, `meta.x-conversionNotes`, `$schema`.
- The editor shows them in the collapsible "Import notes" panel, read-only.
- The AI patch allowlist denies `/meta/**` and `/$schema` (see §6 of this file).
- `saveCvRevision` must re-apply them from the current revision server-side, so a client
  can't change them by posting a modified document.

## 4. Persistence: person → cv → cv_revision

- `person` (1) → `cv` (n, one per `variant`; unique `(personId, variant)` among non-archived)
  → `cv_revision` (n, `number` 1..n). `cv.currentRevisionId` points at the live revision.
- **Primary version:** `person.primaryCvId`. Search results list it first. Set via
  `setPrimaryCv`; on import it comes from `index.json` `people[].primary`.
- `cv_revision` is **append-only**: SQLite triggers `RAISE(ABORT)` on UPDATE/DELETE. Only
  `person.erase` drops the trigger, inside its own transaction. Never "fix" a revision in
  place; write a new one.
- Each revision stores `data` (JSON text), `dataSha256` (sha256 of the stored JSON string),
  `source` enum `import | manual | ai | restore | duplicate`, optional `message` (≤ 200),
  `authorId`, `aiMessageId` (for `source: ai`).
- **Optimistic concurrency:** `saveRevision({ cvId, baseRevisionId, data })` returns
  `CONFLICT` (409) if `cv.currentRevisionId !== baseRevisionId`. The UI shows a diff against
  the newer revision. Never auto-merge silently.
- One transaction per save: insert revision + move `currentRevisionId` + rebuild `cv_facet`
  and `cv_search` from the new data + audit event. Roll back everything on any error.
- Restore = new revision with `source: restore` copying old `data`. Create variant = new `cv`
  whose revision 1 is `source: duplicate`, message records the origin.

## 5. Import (`scripts/import-sample-data.ts`, `pnpm db:import`)

- Reads `sample_data/index.json` + `sample_data/cvs/*.json`, validates **all** files first,
  then writes in one transaction. Any failure aborts the whole import with a readable report
  (file + path + issue). Nothing is imported partially.
- Creates `person` (`legacyId` = `pNN`) + `cv` + revision 1 (`source: import`), sets
  `primaryCvId`.
- **Idempotent:** upsert on `legacyId` + `variant`. Re-running with unchanged files creates
  no new revisions (compare `dataSha256`). Integration test: import twice, counts unchanged.
- Report counts and ids only. Never print CV content or names to the console/log.

## 6. Adding (or removing) a CV field end to end

Work test-first (red → green → refactor). Tick every box, even when the answer is "no change".
1. [ ] **JSON Schema:** add it to `sample_data/schema/cv.schema.json` as an `x-` extension
   (never invent non-`x-` fields in standard objects). Closed objects: list every property.
2. [ ] **Zod:** mirror it in `src/cv/schema.ts` with the same optionality, limits and regex.
   Run the drift test (Ajv + Zod over all samples). Add negative cases.
3. [ ] **Fixtures:** extend the factory `buildCv({...overrides})` in `tests/fixtures/`. Don't
   hand-copy sample files. Don't add real-looking people (use "Anna Example").
4. [ ] **Editor:** form section in `src/features/editor/` with inline Zod messages
   (`aria-describedby`), keyboard add/remove/reorder for arrays, `data-testid`.
5. [ ] **PDF template:** `src/pdf/template/`. Decide the section and reading order; keep
   DOM order = reading order; extend `tests/integration/pdf.test.ts` if it must be extracted.
6. [ ] **Search:** `src/cv/search-text.ts` — which FTS column (name/label/variant/keywords/
   skills/clients/industries/roles/body) and whether it feeds a `cv_facet` kind.
7. [ ] **AI patch allowlist** (`src/cv/patch.ts`, §7.6): allowed paths are
   `/basics/{label,summary,x-experienceSummary,x-tagline,x-keywords,x-industries,x-strengths,x-keyRoles,x-keySkills}/**`, `/skills/**`, `/projects/**`, `/work/**`, `/education/**`,
   `/certificates/**`, `/languages/**`, `/x-testimonials/**`. Denied: `/meta/**`,
   `/basics/{name,email,phone,url,location,profiles}`, `/$schema`. Contact data, identity
   and app-managed fields must stay denied. The basics allowlist is explicit (no wildcard), so
   a new field is denied by default. Add it to the list only on purpose, and add a unit test.
8. [ ] **Minimizer** (`src/server/services/ai.ts`): must it be stripped before the LLM call?
   Anything personal/contact-like or internal (like conversion notes) = strip. Test it.
9. [ ] **Export stripping:** the `cv.json` PDF attachment and JSON export drop
   `meta.x-conversionNotes`, and contact details unless included. Decide for the new field.
10. [ ] **Diff labels:** `src/cv/diff.ts` gives it a human-readable section name.
11. [ ] **Read-only?** If app-managed, add it to §3 handling (UI read-only + server re-apply).
12. [ ] Update this skill's table and `sample_data/README.md` field table.

Removing a field: old revisions keep it forever (append-only). Keep it optional in the schema
(or migrate by writing new revisions), never by editing stored revisions.

## 7. Immutability

- Never mutate CV objects. `src/cv/` is pure: functions take a `Readonly` document and
  return a new one (spread / `structuredClone` + build, `toSorted`, `with`, `toSpliced`).
- `applyPatch` returns a new document and leaves the input untouched; test that with
  `Object.freeze` (deep) inputs.
- Editor drafts update through new objects only (TanStack Form values, no in-place edits).

## 8. Data handling (personal data)

- CV content is real personal data, even in samples. Never send it to external services,
  paste it into URLs, or add network calls that upload it (`AGENTS.md`).
- Never log CV content: the logger redacts CV `data`, `email`, `phone`. Log ids, counts,
  revision numbers and hashes only. `audit_event.meta` never contains CV content.
- The only allowed outbound path is the opt-in `anthropic` provider, with a minimized CV.
- In tests, docs and examples use invented placeholders ("Anna Example",
  `anna@example.com`), never names or contact details copied from `sample_data/`.
