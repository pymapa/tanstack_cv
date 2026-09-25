# Intent: Kipinä CV bank

## What and why

Build a CV bank where Kipinä can manage and edit the CVs of its employees and, later, its
subcontractors.

The main output is a **downloadable PDF CV for a client**. It has to look good, be easy to
skim and sum up what the person is good at. Kipinä's current CVs look very different from
competitors' CVs, and that has worked in our favour. The new output has to keep that
distinctive look.

The CV data does not have to be stored or managed as documents (today the CVs are
PowerPoint files). Structured data is preferred for storage, with document exports
created as needed.

## Success criteria

- When a client asks for a CV, a salesperson can find the right person and CV version,
  adjust it if needed, and send a polished PDF **the same day**.
- A salesperson does all of this without writing code or editing files by hand.
- The PDF looks like it came from Kipinä. It does not look like a generic template or
  AI-generated filler.
- What gets built can be developed further and actually put into use. It is not a
  throwaway demo.

## Scope and timebox

The time budget is **five hours**. The whole system will not be finished in that time. It
is fine, and expected, to write down features that were designed but not built (see
[Considered but not built](#considered-but-not-built)).

Subcontractors are a small, even marginal, part of the need and are not a focus for now.

## Users and roles

| Role | Who | Needs |
|---|---|---|
| Salesperson | Kipinä salesperson, cannot code | Find people and CV versions, adjust a CV for a client need, export a PDF quickly |
| Expert | The Kipinä employee the CV describes | Keep their own CV(s) up to date |

- Only Kipinä employees can sign in and edit. (local users fine in first iteration,
  the point is not to spend your time budget on an Entra ID integration)
- Subcontractors do not edit their own CVs. If their CVs are in the system, a Kipinä
  employee maintains them.

## Must have

1. **Several CVs per person.** One person can have several CVs ("profiles") at the same
   time. For example, someone who works as a project manager in one client project and as
   a product owner in another needs a CV for each role. The test data has examples of this:
   `p10` has 8 role-specific versions and `p03` has 2.
2. **Speed.** It must be possible to find, personalize and send a CV on the same day the
   need comes up.
3. **Ease of use.** Non-technical salespeople can use it without help.
4. **Desktop-first.** The work is done on a computer. Mobile support is not needed.
5. **Accessibility.** Take accessibility into account both in the application and in the
   PDF template. It is a factor to take into account, but there is no strict WCAG
   compliance requirement.
6. **Visual quality.** The PDF looks like Kipinä, not AI slop.
7. **Security.** CVs contain personal data and client information that must not leak.
   Build it as if the data were real, even though the test data is fictional.
8. **Access control.** Only Kipinä employees have access. Subcontractors do not edit
   their own CVs.
9. **Machine-readability of output CVs.** Because customers use AI for vetting, the PDF
   exports must be easy for machines to read, too.

## Nice to have

- **Every employee has a CV.** For example, a Slack reminder to anyone who doesn't have a
  CV yet.
- **Every CV stays up to date.** For example, a reminder every three months to review and
  update your CV.
- **Search by skills.** Keyword search, for example by technology or by client.

## Non-functional requirements

- **Only local dev env for now.** Deploying to cloud is not required within today's time
  box. If you have the time to do it securely you can, but this won't gain you any extra
  points.
- **Expected traffic is negligble.** The expected traffic is trivial, with the amount of
  concurrent users realistically usually 0-3 and by definition, at most 40.

## Considered but not built

Record here any feature that was designed or discussed but not built within the timebox,
with a short note on the intended approach. This list is part of the deliverable.

- **Authentication and access control (spec M2):** Better Auth with local users, roles
  admin/sales/expert, a `can()` policy on every server function, and an audit log. The UI and
  server functions are built without it for now; the dev server is bound to localhost only.
  This is the next thing to build before anyone else uses the app.
- **Persistent storage (spec M1):** PostgreSQL + Drizzle with append-only revisions and a
  full-text search index. The local Postgres (`pnpm db:up`) and its connection pool exist. Today an in-memory store behind the same `CvRepository` interface is seeded from
  `sample_data/`, so edits are lost on restart.
- **AI chat editing (spec §7.6, M6):** the model proposes a validated JSON patch, the user reviews
  it as diff cards and accepts or rejects each change, and the result is saved as a revision.
  The provider is off until a human approves the data transfer (spec §9.3).
- **History diff and restore (spec §7.5):** compare two revisions and restore an old one as a new
  revision. The history list is built; diff and restore are not.
- **Variants, tags, primary version:** "Create variant from this", set primary, archive, and
  curated tags as a search facet (spec §7.3, §7.8).
- **Export options dialog:** a contact-details toggle (the API supports `?contact=1`), section
  toggles, and a project limit so long CVs fit the cover page.
- **Staleness reminders:** a "needs review" dashboard and Slack reminders (spec §7.10).
- **Final answer when the chatbot's loop guard stops it.** The guard in
  `src/lib/ai/loop-guard.ts` ends the run after too many turns or repeated identical tool
  calls, and the reply can then end without a summary. Intended approach: when the guard
  trips, run one more model turn with tools disabled and ask for an answer from what was
  found so far.
- **Saved chat history per signed-in user.** The CV assistant's chat is saved in Postgres per
  browser (an HttpOnly cookie) and can be cleared from the panel. Intended approach: once sign-in
  exists, use the user id as the owner key, so a salesperson gets their chat on any device. A
  scheduled purge job would replace the purge that now runs on every save or clear. Saved chats
  quote CVs in tool results, so `erasePerson` (not built yet) must also delete the chats that
  mention the person's CV ids or file names.
- **Word work specs in the chatbot.** The chat accepts PDF, `.txt`, and `.md` specs. Intended
  approach for `.docx`: extract the text on the server behind a size and type check, then send it
  as a `<work_spec>` text block like the other text files. This needs a parsing dependency.
- **Request size cap on `/api/cv-chat`.** Attachments are checked after the body is parsed, so a
  huge body is still read into memory. Intended approach: reject bodies over about 20 MB by
  `Content-Length` and by counting streamed bytes, before parsing.
- **Sign-in for the chatbot.** The chat widget and `/api/cv-chat` are open to anyone who can
  reach the dev server, like the rest of the app for now. They should sit behind the same
  sign-in as the rest of the CV bank.

- **PowerPoint and Word CVs in the CV builder.** Kipinä's old CVs are mostly `.pptx`, but the
  builder reads PDF, `.txt` and `.md` only. Intended approach: extract the text on the server behind
  a size and type check and send it as an `<old_cv>` block, like the `.docx` work specs above. This
  needs a parsing dependency.
- **A source format for CVs made in the app.** `meta.sourceFormat` only allows `pptx` or `pdf`, so
  new CVs get `pdf`. Intended approach: add `app` to the enum in `src/cv/schema.ts` and
  `sample_data/schema/cv.schema.json`.
- **New CVs in the CV bank chat.** The CV bank agent's tools read `sample_data/` from disk, so it
  can't find people created in the app. Intended approach: read people and CVs through
  `CvRepository` like the rest of the app.
- **New CV for an existing person.** "New CV" always creates a new person. Intended approach: the
  "Create variant" action from spec §7.3, which can open the same builder with the person set.
- **Style check in the form.** The builder agent uses `checkBrand`, but the user doesn't see its
  findings. Intended approach: a small "Style check" list above the Create CV button, linked to
  the fields.

- **Contact details in PDF old CVs.** Text old CVs lose emails, phone numbers and links before
  they're sent, but a PDF goes to the model as it is. Intended approach: extract the PDF text on the
  server, remove contact details the same way, and send it as an `<old_cv>` block.
- **Old CV sent once per turn.** Each builder tool call is a round trip that re-sends the whole
  conversation, the old CV included. Intended approach: send the file once (Anthropic Files API or
  a server-side text copy) and use prompt caching for the rest.
- **Saved CV builder chat.** The builder chat lasts as long as the page. Intended approach: the
  saved-chat store of the CV assistant, keyed by the draft once drafts are saved.

## Test data

`sample_data/` contains anonymized, realistic CV data: 28 people and 36 CV versions. See
`sample_data/README.md` for details.

- Every CV is a valid [JSON Resume](https://jsonresume.org/schema) 1.0 document. Fields
  specific to Kipinä's template use an `x-` prefix (strengths, key roles, key skills,
  per-technology years, testimonials, etc.). The schema is in
  `sample_data/schema/cv.schema.json`.
- `sample_data/index.json` lists each person, their CV versions and their primary version.
  `meta.variant` names the purpose of each version (`default`, `PM`, `SM-PO-AI`, …).
- All people, clients, employers and contact details are fictional. The source CVs were
  PowerPoint files (`meta.sourceFormat: "pptx"`).
