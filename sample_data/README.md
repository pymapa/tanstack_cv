# Anonymized CVs – test data

This directory contains structured CV data to serve as test data for developing and testing
a new CV system. The data is as realistic as possible, but all people, clients, former
employers, product names and contact details are fictional. Industries, roles, years and
technologies come from real CVs, so the data is realistic.

## Contents

```
output/
  index.json               people, their CV versions and the main version (primary)
  cvs/pNN-vM.json          a single CV version (NN = person, M = version)
  schema/cv.schema.json    JSON Schema: JSON Resume 1.0 + extensions
  schema/jsonresume.schema.json   official JSON Resume schema (referenced above)
```

- 28 people, 36 CV versions. One person has 8 role-specific versions (p10) and one has
  two (p03). Everyone else has one version.
- `index.json` → `people[].primary` points to the person's main version: the latest complete
  version, or the root version the others were derived from.
- `meta.variant` describes the purpose of the version (e.g. `default`, `PM`, `SM-PO-AI`).

## Data model

Every file is a valid [JSON Resume](https://jsonresume.org/schema) 1.0 document.
Additional fields from the Kipinä template are in fields prefixed with `x-`:

| Field | Content |
|---|---|
| `basics.x-experienceSummary` | e.g. "20+ years of business experience" |
| `basics.x-tagline` | the person's motto |
| `basics.x-keywords`, `basics.x-industries` | keywords and industry expertise |
| `basics.x-strengths` | "In a nutshell" strengths `{title, description}` |
| `basics.x-keyRoles`, `basics.x-keySkills` | key roles and key skills `{title, description?}` |
| `basics.x-hobbies` | generalized mention of hobbies |
| `skills[].x-skillDetails` | per-technology experience `{name, years, yearsText}` |
| `skills[].level` | per-category experience, when years are given for the whole category |
| `projects[].entity` | client (fictional name or generic description) |
| `projects[].x-employer` | employer during the project |
| `projects[].x-industry`, `x-duration`, `x-highlight`, `x-note` | industry, duration as text, highlighted project, conversion note |
| `certificates[].x-dateText` | original date, if it is not in ISO 8601 format |
| `x-testimonials` | testimonials (rewritten) |
| `meta.personId`, `variant`, `sourceFormat`, `x-cvYear` | version information |
| `meta.x-conversionNotes` | errors found in the source data and interpretations made |
| `meta.x-template` | PDF template id, see spec §7.7; missing means `kipina-portrait` |

## Notes for testers

- The source CVs contained errors, such as typos in dates, placeholder text and repeated blocks.
  These have been fixed or removed, and every interpretation is recorded in the `x-note` or `meta.x-conversionNotes` field.
- Dates are given with year or year-and-month precision (`2021`, `2021-05`). An ongoing
  project has no `endDate` field.
- Some projects have no dates, because the source didn't have them either.
- Contact details are fictional (`@example.com`, `+358 40 000 xxxx`).
